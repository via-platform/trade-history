const {CompositeDisposable, Disposable, Emitter} = require('via');
const TradeHistory = require('./trade-history');
const base = 'via://trade-history';

const InterfaceConfiguration = {
    name: 'Trade History',
    description: 'Time & Sales data for a particular symbol.',
    command: 'trade-history:create-trade-history',
    uri: base
};

class TradeHistoryPackage {
    activate(){
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.histories = [];

        this.disposables.add(via.commands.add('via-workspace, .symbol-explorer .market', 'trade-history:create-trade-history', this.create.bind(this)));

        this.disposables.add(via.workspace.addOpener((uri, options) => {
            if(uri === base || uri.startsWith(base + '/')){
                const history = new TradeHistory({uri, omnibar: this.omnibar});

                this.histories.push(history);
                this.emitter.emit('did-create-trade-history', history);

                return history;
            }
        }, InterfaceConfiguration));

        this.emitter.emit('did-activate');
    }

    create(e){
        e.stopPropagation();

        if(e.currentTarget.classList.contains('market')){
            const market = e.currentTarget.getMarket();
            via.workspace.open(`${base}/${market.exchange.id}/${market.symbol}`, {});
        }else{
            via.workspace.open(base);
        }
    }

    consumeActionBar(actionBar){
        this.omnibar = actionBar.omnibar;

        for(const history of this.histories){
            history.consumeOmnibar(this.omnibar);
        }
    }

    deactivate(){
        this.emitter.emit('did-deactivate');
        this.disposables.dispose();
        this.disposables = null;
    }

    onDidActivate(callback){
        return this.emitter.on('did-activate', callback);
    }

    onDidDeactivate(callback){
        return this.emitter.on('did-deactivate', callback);
    }
}

module.exports = new TradeHistoryPackage();
