const {Disposable, CompositeDisposable, Emitter} = require('via');
const ViaTable = require('via-table');
const BaseURI = 'via://trade-history';
const moment = require('moment');
const etch = require('etch');
const $ = etch.dom;

const table = {
    headers: false,
    columns: [
        //TODO implement a visual size chart in the first column
        // {
        //     element: () => $.div({classList: 'td'}, '-'),
        //     classes: 'scale'
        // },
        {
            element: row => {
                let head = row.size.toString();
                let tail = '00000000';

                if(head.indexOf('.') === -1){
                    return $.div({classList: 'td size'}, $.span({}, head + '.0'), tail.slice(1));
                }else{
                    return $.div({classList: 'td size'}, $.span({}, head), tail.slice(head.split('.')[1].length));
                }
            },
            classes: 'size',
            align: 'right'
        },
        {
            accessor: d => d.price.toFixed(2),
            classes: d => 'price ' + d.side,
            align: 'right'
        },
        {
            accessor: d => moment(d.date).format('H:mm:ss'),
            classes: 'time',
            align: 'right'
        }
    ]
};

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
        this.width = 0;
        this.height = 0;
        this.matches = null;
        this.trades = [];
        this.symbol = via.symbols.findByIdentifier(this.getURI().slice(BaseURI.length + 1));

        if(this.symbol){
            this.emitter.emit('did-change-symbol', this.symbol);
            this.matches = this.symbol.matches();
            this.disposables.add(this.matches.subscribe(this.draw.bind(this)));
        }

        etch.initialize(this);
        this.draw();
    }

    render(){
        let base = this.symbol.name.split('-').pop();

        return $.div({classList: 'trade-history table'},
            $.div({classList: 'thead'},
                //TODO commented out until there is a visual size chart
                // $.div({classList: 'th'}),
                $.div({classList: 'th'}, 'Trade Size'),
                $.div({classList: 'th'}, `Price (${base})`),
                $.div({classList: 'th'}, 'Time')
            ),
            $.div({classList: 'tbody'},
                $(ViaTable, {columns: table.columns, data: this.trades, classes: ['matches']})
            )
        );
    }

    update(){}

    draw(){
        // console.log('update')
        this.trades = this.matches.snapshot();
        etch.update(this);
    }

    destroy(){
        this.disposables.dispose();
        this.emitter.dispose();
        this.resizeObserver.disconnect();
        this.emitter.emit('did-destroy');
    }

    getURI(){
        return this.uri;
    }

    getIdentifier(){
        return this.uri ? this.uri.slice(BaseURI.length + 1) : undefined;
    }

    getTitle(){
        return this.symbol ? `Trade History - ${this.symbol.identifier}` : 'Trade History';
    }

    changeSymbol(symbol){
        this.symbol = symbol;
        this.emitter.emit('did-change-symbol', symbol);
    }

    changeAggregation(aggregation){
        this.aggregation = aggregation;
        this.emitter.emit('did-change-aggregation', aggregation);
    }

    onDidChangeAggregation(callback){
        return this.emitter.on('did-change-aggregation', callback);
    }

    onDidChangeData(callback){
        return this.emitter.on('did-change-data', callback);
    }

    onDidChangeSymbol(callback){
        return this.emitter.on('did-change-symbol', callback);
    }

    onDidDestroy(callback){
        return this.emitter.on('did-destroy', callback);
    }

    onDidResize(callback){
        return this.emitter.on('did-resize', callback);
    }

    onDidDraw(callback){
        return this.emitter.on('did-draw', callback);
    }
}
