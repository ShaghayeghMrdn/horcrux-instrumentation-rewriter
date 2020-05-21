
var program = require('commander')
var fs = require('fs');
var util = require('util')
program
    .option('-i, --input [input]','input heap profile')
    .option('-o, --output [output]','output processed file')
    .parse(process.argv)


const self = global;

self.HeapSnapshotModel = {};

require('chrome-devtools-frontend/front_end/heap_snapshot_model/HeapSnapshotModel');

self.HeapSnapshotWorker = {};
self.HeapSnapshotModel= HeapSnapshotModel;
self.Common = { UIString: x => x };

self.TextUtils = { TextUtils: {} };
require('chrome-devtools-frontend/front_end/common/TextUtils');

const runtime = { queryParam: () => false };
self.Runtime = runtime;
self.self = {
  Runtime: runtime,
  addEventListener: () => {}
};

require('chrome-devtools-frontend/front_end/heap_snapshot_worker/AllocationProfile');
require('chrome-devtools-frontend/front_end/heap_snapshot_worker/HeapSnapshot');
require('chrome-devtools-frontend/front_end/heap_snapshot_worker/HeapSnapshotLoader');
require('chrome-devtools-frontend/front_end/heap_snapshot_worker/HeapSnapshotWorkerDispatcher');
require('chrome-devtools-frontend/front_end/heap_snapshot_worker/HeapSnapshotWorker');


const {HeapSnapshotWorkerDispatcher, HeapSnapshotLoader} = self.HeapSnapshotWorker;

const dispatcher = new HeapSnapshotWorkerDispatcher({}, () => {});

const loader = new HeapSnapshotLoader(dispatcher);

var inputData = fs.readFileSync(program.input, "utf-8");

loader.write(inputData);
loader.close();
var snapshot = loader.buildSnapshot();

// console.log(snapshot.totalSize);
process.stdout.write(util.format(snapshot.totalSize/(1000*1000) + " "));



// fs.writeFileSync(program.output, JSON.stringify(snapshot));