const {Disposable, CompositeDisposable, Emitter, Matches} = require('via');
const ViaTable = require('via-table');
const base = 'via://trade-history';
const moment = require('moment');
const etch = require('etch');
const $ = etch.dom;

module.exports = class TradeHistory {
    static deserialize(params){
        return new TradeHistory(params);
    }

    serialize(){
        return {
            uri: this.uri
        };
    }

    constructor(params = {}){
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.uri = params.uri;
        this.omnibar = params.omnibar;
        this.width = 0;
        this.height = 0;
        this.matches = null;
        this.trades = [];
        this.market = null;
        this.orderbookDisposable = null;
        this.max = 1;

        this.columns = [
            //TODO implement a visual size chart in the first column
            {
                element: row => $.div({classList: 'td scale'},
                    $.div({classList: `scale-bar ${row.side}`, style: `width: ${(row.amount / this.max * 100)}%;`})
                ),
                classes: 'scale'
            },
            {
                element: row => {
                    if(!row || !row.amount) debugger;
                    let head = row.amount.toFixed(8).replace(/0+$/g, '');
                    let tail = '00000000';

                    if(head.slice(-1) === '.'){
                        head += '0';
                    }

                    return $.div({classList: 'td size'}, $.span({}, head), tail.slice(head.split('.')[1].length));
                },
                classes: 'size',
                align: 'right'
            },
            {
                accessor: d => d.price.toFixed(this.market ? this.market.precision.price : 2),
                classes: d => 'price ' + d.side,
                align: 'right'
            },
            {
                accessor: d => moment(d.date).format('H:mm:ss'), //TODO user time preferences
                classes: 'time',
                align: 'right'
            }
        ];

        etch.initialize(this);
        this.changeMarket(via.markets.findByIdentifier(this.getURI().slice(base.length + 1)));

        this.draw();
    }

    render(){
        return $.div({classList: 'trade-history'},
            $.div({classList: 'toolbar'},
                $.div({classList: 'toolbar-button', onClick: this.change},
                    this.market ? this.market.title() : 'Select Market'
                )
            ),
            $.div({classList: 'thead'},
                $.div({classList: 'th'}, ''),
                $.div({classList: 'th'}, 'Trade Size'),
                $.div({classList: 'th'}, `Price (${this.market ? this.market.base : 'N/A'})`),
                $.div({classList: 'th'}, 'Time')
            ),
            $.div({classList: 'trade-history-table'},
                $(ViaTable, {columns: this.columns, data: this.trades, classes: ['matches']})
            )
        );
    }

    update(){}

    draw(){
        if(this.market){
            this.trades = this.matches.snapshot();
        }

        this.max = 0;

        for(const trade of this.trades){
            this.max = (this.max > trade.amount) ? this.max : trade.amount;
        }

        if(this.max <= 0) this.max = 1;

        etch.update(this);
    }

    destroy(){
        if(this.matches){
            this.matches.destroy();
        }

        this.emitter.emit('did-destroy');
        this.disposables.dispose();
        this.emitter.dispose();
    }

    change(){
        if(this.omnibar){
            this.omnibar.search({
                name: 'Change Trade History Market',
                placeholder: 'Enter a Market to Display...',
                didConfirmSelection: this.changeMarket.bind(this),
                maxResultsPerCategory: 30,
                items: via.markets.all()
            });
        }else{
            console.error('Could not find omnibar.');
        }
    }

    getURI(){
        return this.uri;
    }

    getIdentifier(){
        return this.uri ? this.uri.slice(base.length + 1) : undefined;
    }

    getTitle(){
        return this.market ? `Trade History, ${this.market.name}` : 'Trade History';
    }

    consumeOmnibar(omnibar){
        this.omnibar = omnibar;
    }

    changeMarket(market){
        if(!market || this.market === market) return;

        if(this.matches){
            this.matches.destroy();
            this.matches = null;
        }

        this.max = 1;
        this.market = market;
        this.trades = [];
        etch.update(this);

        if(this.market.exchange.hasObserveTrades){
            this.matches = new Matches(this.market);
            this.matches.onDidUpdate(this.draw.bind(this));
        }else{
            //TODO Indicate that this is unsupported
        }

        this.emitter.emit('did-change-market', market);
    }

    onDidUpdate(callback){
        return this.emitter.on('did-change-data', callback);
    }

    onDidChangeMarket(callback){
        return this.emitter.on('did-change-market', callback);
    }

    onDidDestroy(callback){
        return this.emitter.on('did-destroy', callback);
    }

    onDidDraw(callback){
        return this.emitter.on('did-draw', callback);
    }
}
