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
            uri: this.getURI(),
            group: this.group ? this.group.color : ''
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
                title: () => this.market && this.market.contract_size ? `Contracts (${this.market.contract_size} ${this.market.quote})` : `Size (${this.market ? this.market.base : 'Base'})`,
                default: true,
                classes: 'size',
                align: 'right',
                element: row => {
                    const [head, tail] = via.fn.number.formatToHeadTail(row.size, this.market.precision.amount);

                    return $.div({classList: 'td size'},
                        $.span({},
                            via.fn.number.formatString(head)
                        ), tail
                    );
                }
            },
            {
                name: 'size-quote',
                title: () => `Size (${this.market ? this.market.quote : 'Quote'})`,
                default: false,
                classes: 'size',
                align: 'right',
                element: row => {
                    const [head, tail] = via.fn.number.formatToHeadTail(row.size * row.price, this.market.precision.amount);

                    return $.div({classList: 'td size'},
                        $.span({},
                            via.fn.number.formatString(head)
                        ), tail
                    );
                }
            },
            {
                name: 'price',
                title: () => `Price (${this.market ? this.market.quote : 'N/A'})`,
                default: true,
                accessor: d => this.market ? via.fn.number.formatPrice(d.price, this.market) : '',
                classes: d => `price ${d.taker_side}`,
                align: 'right'
            },
            {
                name: 'time',
                title: 'Time',
                default: true,
                accessor: d => via.fn.time.formatString(d.execution_time, 'H:mm:ss'),
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

        this.changeGroup(state.group ? via.workspace.groups.get(state.group) : null);

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

        if(this.groupDisposables){
            this.groupDisposables.dispose();
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
                items: via.markets.tradeable().map(m => ({name: m.title, group: m.active ? 'active' : 'inactive', description: m.description, market: m}))
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

        if(this.group){
            this.group.market = market;
        }
    }

    changeGroup(group){
        if(this.group === group){
            return;
        }

        this.group = group;

        if(this.groupDisposables){
            this.groupDisposables.dispose();
            this.groupDisposables = null;
        }

        if(this.group){
            this.groupDisposables = new CompositeDisposable(
                this.group.onDidChangeMarket(this.changeMarket.bind(this))
            );

            if(this.group.market){
                this.changeMarket(this.group.market);
            }else{
                this.group.market = this.market;
            }
        }

        this.emitter.emit('did-change-group', this.group);
    }

    getMarket(){
        return this.market;
    }

    onDidChangeGroup(callback){
        return this.emitter.on('did-change-group', callback);
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
