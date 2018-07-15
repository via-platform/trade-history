const {Disposable, CompositeDisposable, Emitter, Matches} = require('via');
const ViaTable = require('via-table');
const base = 'via://trade-history';
const moment = require('moment');
const etch = require('etch');
const $ = etch.dom;

module.exports = class TradeHistory {
    static deserialize(params, state){
        return new TradeHistory(params, state);
    }

    serialize(){
        return {
            deserializer: 'TradeHistory',
            uri: this.getURI()
        };
    }

    constructor({manager, omnibar}, state = {}){
        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.uri = state.uri;
        this.manager = manager;
        this.omnibar = omnibar;
        this.width = 0;
        this.height = 0;
        this.matches = null;
        this.trades = [];
        this.market = null;
        this.max = 1;

        this.columns = [
            {
                name: 'scale',
                title: 'Relative Size',
                default: true,
                classes: 'scale',
                element: row => $.div({classList: 'td scale'},
                    $.div({classList: `scale-bar ${row.taker_side}`, style: `width: ${(row.size / this.max * 100)}%;`})
                )
            },
            {
                name: 'size-base',
                title: () => `Size (${this.market ? this.market.base : 'Base'})`,
                default: true,
                classes: 'size',
                align: 'right',
                element: row => {
                    let head = row.size.toFixed(8).replace(/0+$/g, '');
                    let tail = '00000000';

                    if(head.slice(-1) === '.'){
                        head += '0';
                    }

                    return $.div({classList: 'td size'}, $.span({}, head), tail.slice(head.split('.')[1].length));
                }
            },
            {
                name: 'size-quote',
                title: () => `Size (${this.market ? this.market.quote : 'Quote'})`,
                default: false,
                classes: 'size',
                align: 'right',
                element: row => {
                    let head = (row.size * row.price).toFixed(8).replace(/0+$/g, '');
                    let tail = '00000000';

                    if(head.slice(-1) === '.'){
                        head += '0';
                    }

                    return $.div({classList: 'td size'}, $.span({}, head), tail.slice(head.split('.')[1].length));
                }
            },
            {
                name: 'price',
                title: () => `Price (${this.market ? this.market.quote : 'N/A'})`,
                default: true,
                accessor: d => d.price.toFixed(this.market ? this.market.precision.price : 2),
                classes: d => `price ${d.taker_side}`,
                align: 'right'
            },
            {
                name: 'time',
                title: 'Time',
                default: true,
                accessor: d => moment(d.execution_time).format('H:mm:ss'), //TODO user time preferences
                classes: 'time',
                align: 'right'
            }
        ];

        etch.initialize(this);

        this.disposables.add(via.config.observe('trade-history.numberOfTrades', this.draw.bind(this)));
        this.disposables.add(via.commands.add(this.element, 'trade-history:change-market', this.change.bind(this)));

        this.initialize(state);
    }

    async initialize(state){
        await via.markets.initialize();

        const [method, id] = this.uri.slice(base.length + 1).split('/');

        if(method === 'market'){
            const market = via.markets.uri(id);
            this.changeMarket(market);
            this.draw();
        }
    }

    render(){
        return $.div({classList: 'trade-history', tabIndex: -1},
            $.div({classList: 'toolbar'},
                $.div({classList: 'toolbar-button', onClick: this.change},
                    this.market ? this.market.title : 'Select Market'
                )
            ),
            $(ViaTable, {columns: this.columns, data: this.trades, classes: 'trade-history-table'})
        );
    }

    update(){}

    draw(){
        if(this.market){
            this.trades = this.market.trades.snapshot();
        }

        this.max = 0;

        for(const trade of this.trades){
            this.max = (this.max > trade.size) ? this.max : trade.size;
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
                didConfirmSelection: selection => this.changeMarket(selection.market),
                maxResultsPerCategory: 60,
                items: via.markets.all().filter(m => m.active && m.type === 'SPOT').map(m => ({name: m.title, description: m.description, market: m}))
            });
        }else{
            console.error('Could not find omnibar.');
        }
    }

    getURI(){
        return this.market ? `${base}/market/${this.market.uri()}` : base;
    }

    getIdentifier(){
        return this.uri ? this.uri.slice(base.length + 1) : undefined;
    }

    getTitle(){
        return this.market ? `Trade History, ${this.market.title}` : 'Trade History';
    }

    consumeOmnibar(omnibar){
        this.omnibar = omnibar;
    }

    changeMarket(market){
        if(!market || this.market === market) return;

        if(this.subscription){
            this.subscription.dispose();
            this.subscription = null;
        }

        this.market = market;
        this.max = 1;
        this.trades = [];

        this.subscription = this.market.trades.subscribe(this.draw.bind(this));
        //via.config.get('trade-history.numberOfTrades');

        etch.update(this);
        this.emitter.emit('did-change-market', market);
    }

    getMarket(){
        return this.market;
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
