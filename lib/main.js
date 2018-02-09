const {CompositeDisposable, Disposable, Emitter} = require('via');
const TradeHistory = require('./trade-history');
const BaseURI = 'via://trade-history';

const InterfaceConfiguration = {
    name: 'Trade History',
    description: 'Time & Sales data for a particular symbol.',
    command: 'trade-history:create-trade-history',
    uri: BaseURI
};

class TradeHistoryPackage {
    activate(){
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.histories = [];

        via.commands.add('via-workspace', {
            'trade-history:create-trade-history': () => via.workspace.open(BaseURI)
        });

        this.disposables.add(via.workspace.addOpener((uri, options) => {
            if(uri === BaseURI || uri.startsWith(BaseURI + '/')){
                const history = new TradeHistory({uri, omnibar: this.omnibar});

                this.histories.push(history);
                this.emitter.emit('did-create-trade-history', history);

                return history;
            }
        }, InterfaceConfiguration));

        this.emitter.emit('did-activate');
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
