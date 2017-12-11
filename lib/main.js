const {CompositeDisposable, Disposable, Emitter} = require('via');
const TradeHistory = require('./trade-history');
const BaseURI = 'via://trade-history/GDAX:BTC-USD';

class TradeHistoryPackage {
    activate(){
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.histories = [];

        via.commands.add('via-workspace', {
            'trade-history:default': () => via.workspace.open(BaseURI)
        });

        this.disposables.add(via.workspace.addOpener((uri, options) => {
            if(uri.startsWith(BaseURI)){
                let history = new TradeHistory({uri});

                this.histories.push(history);
                this.emitter.emit('did-create-trade-history', history);

                return history;
            }
        }));

        this.emitter.emit('did-activate');
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
