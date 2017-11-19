const {CompositeDisposable, Disposable, Emitter} = require('via');
const BaseURI = 'via://trade-history';




const {Disposable, CompositeDisposable, Emitter} = require('via');
const d3 = require('d3');
const ChartCenter = require('./chart-center');
const ChartData = require('./chart-data');
const ChartStudy = require('./chart-study');
const ChartPanels = require('./chart-panels');
const ChartTools = require('./chart-tools');
const ChartAxis = require('./chart-axis');
const _ = require('underscore-plus');
const ChartDefaults = {end: 0, start: Date.now() - 864e5};
const ChartAreas = 'top left bottom right'.split(' ');
const BaseURI = 'via://charts';

const AXIS_HEIGHT = 30;
const AXIS_WIDTH = 60;

module.exports = class Chart {
    static deserialize(plugins, params){
        return new Chart(plugins, params);
    }

    serialize(){
        return {
            uri: this.getURI(),
            time: this.time,
            panels: this.panels.serialize(),
            tools: this.tools.serialize(),
            data: this.data.serialize()
        };
    }

    constructor(plugins, params = {}){
        this.plugins = plugins;

        this.disposables = new CompositeDisposable();
        this.emitter = new Emitter();
        this.warnings = [];

        this.panels = [];

        this.uri = params.uri;

        this.width = 0;
        this.height = 0;

        //TODO allow the padding to be customized
        this.padding = 0.2;
        this.bandwidth = 10;
        this.granularity = params.granularity || 3e5

        this.data = new ChartData({chart: this, granularity: this.granularity});

        this.basis = d3.scaleTime().domain([new Date(Date.now() - 36e5), new Date()]);
        this.scale = this.basis.copy();

        this.element = document.createElement('div');
        this.element.classList.add('chart');

        this.resizeObserver = new ResizeObserver(this.resize.bind(this));
        this.resizeObserver.observe(this.element);

        this.symbol = via.symbols.findByIdentifier(this.getURI().slice(BaseURI.length + 1));
        this.table = new ViaTable({

        });

        this.element.appendChild();
    }

    initialize(state = {}){
        this.tools = new ChartTools({chart: this, state: state.tools});
        this.panels = new ChartPanels({chart: this, state: state.panels});
        this.axis = new ChartAxis({chart: this});

        this.element.appendChild(this.tools.element);
        this.element.appendChild(this.panels.element);
        this.element.appendChild(this.axis.element);

    }

    destroy(){
        this.disposables.dispose();
        this.emitter.dispose();
        this.table.destroy();
        this.emitter.emit('did-destroy');
    }

    getURI(){
        return this.uri;
    }

    getIdentifier(){
        return this.getURI().slice(BaseURI.length + 1);
    }

    getTitle(){
        //TODO make the title more helpful
        return 'Trade History';
    }

    changeSymbol(symbol){
        //TODO clear the current trade history and get the new one
        this.symbol = symbol;
        this.emitter.emit('did-change-symbol', symbol);
    }
}
