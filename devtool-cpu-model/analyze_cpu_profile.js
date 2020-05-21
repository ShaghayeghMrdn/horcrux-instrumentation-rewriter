
/*
* This module processes the raw cpu profiler information provided by 
* Chrome developer tools and parses it into a bottom up view
* as shown by the Chrome's graphic interface. 

* Multiple invocations of the same functions:
* - invocations at the same level in the call graph are coallasced together
*
*/

var fs = require('fs');
var resolve = require('resolve');

function requireval(path) {
  const res = resolve.sync(path, {basedir: __dirname});
  const filesrc = fs.readFileSync(res, 'utf8');
  // eslint-disable-next-line no-eval
  // console.log("evaling:" + path);
  eval(filesrc + '\n\n//# sourceURL=' + path);
}

window = self = global = this;
console = console;

// establish our sandboxed globals
Runtime = class {};
Protocol = class {};
TreeElement = class {};

// from generated externs.
// As of node 7.3, instantiating these globals must be here rather than in api-stubs.js
Accessibility = {};
Animation = {};
Audits = {};
Audits2 = {};
Audits2Worker = {};
Bindings = {};
CmModes = {};
Common = {};
Components = {};
Console = {};
DataGrid = {};
Devices = {};
Diff = {};
Elements = {};
Emulation = {};
Extensions = {};
FormatterWorker = {};
Gonzales = {};
HeapSnapshotWorker = {};
Host = {};
LayerViewer = {};
Layers = {};
Main = {};
Network = {};
Persistence = {};
Platform = {};
Profiler = {};
Resources = {};
Sass = {};
Screencast = {};
SDK = {};
Security = {};
Services = {};
Settings = {};
Snippets = {};
SourceFrame = {};
Sources = {};
Terminal = {};
TextEditor = {};
Timeline = {};
TimelineModel = {};
ToolboxBootstrap = {};
UI = {};
UtilitySharedWorker = {};
WorkerService = {};
Workspace = {};
HTMLDivElement = {};
HTMLLabelElement = {}
HTMLButtonElement = {}
HTMLSpanElement = function(){}
document = {}
document.registerElement = function(){}


const noop = function() { };

// other neccessary stubs
Protocol.TargetBase = noop;
Protocol.Agents = {};
ls=function(){return }
UI.VBox = noop;
UI.TreeElement = noop;
UI.beautifyFunctionName = function(e){return e};

DataGrid.ViewportDataGrid = noop;
DataGrid.ViewportDataGridNode = noop;

SDK.targetManager = {};
SDK.targetManager.mainTarget = noop;

requireval('./devtools-monkeypatches.js');

// chrome devtools frontend
requireval('chrome-devtools-frontend/front_end/common/Object.js');
requireval('chrome-devtools-frontend/front_end/common/Console.js');
requireval('chrome-devtools-frontend/front_end/platform/utilities.js');
requireval('chrome-devtools-frontend/front_end/common/ParsedURL.js');
requireval('chrome-devtools-frontend/front_end/common/UIString.js');
requireval('chrome-devtools-frontend/front_end/sdk/Target.js');
requireval('chrome-devtools-frontend/front_end/sdk/LayerTreeBase.js');
requireval('chrome-devtools-frontend/front_end/common/SegmentedRange.js');
requireval('chrome-devtools-frontend/front_end/bindings/TempFile.js');
requireval('chrome-devtools-frontend/front_end/sdk/TracingModel.js');
requireval('chrome-devtools-frontend/front_end/sdk/ProfileTreeModel.js');
requireval('chrome-devtools-frontend/front_end/timeline/TimelineUIUtils.js');
requireval('chrome-devtools-frontend/front_end/timeline_model/TimelineJSProfile.js');
requireval('chrome-devtools-frontend/front_end/sdk/CPUProfileDataModel.js');
requireval('chrome-devtools-frontend/front_end/layers/LayerTreeModel.js');
requireval('chrome-devtools-frontend/front_end/timeline_model/TimelineModel.js');
requireval('chrome-devtools-frontend/front_end/data_grid/SortableDataGrid.js');

requireval('chrome-devtools-frontend/front_end/timeline/TimelineTreeView.js');
requireval('chrome-devtools-frontend/front_end/timeline_model/TimelineProfileTree.js');
requireval('chrome-devtools-frontend/front_end/sdk/FilmStripModel.js');
requireval('chrome-devtools-frontend/front_end/timeline_model/TimelineIRModel.js');
requireval('chrome-devtools-frontend/front_end/timeline_model/TimelineFrameModel.js');
// requireval("chrome-devtools-frontend/front_end/ui/UIUtils.js")
requireval("chrome-devtools-frontend/front_end/data_grid/DataGrid.js")
requireval("chrome-devtools-frontend/front_end/profiler/ProfileDataGrid.js")
requireval("chrome-devtools-frontend/front_end/profiler/BottomUpProfileDataGrid.js")
requireval("chrome-devtools-frontend/front_end/ui/View.js")
requireval("chrome-devtools-frontend/front_end/profiler/ProfileHeader.js")
requireval("chrome-devtools-frontend/front_end/profiler/ProfileView.js")
requireval("chrome-devtools-frontend/front_end/profiler/TopDownProfileDataGrid.js")



// var jsProfile = JSON.parse(fs.readFileSync(process.argv[2]))
// var procJsProfile = new SDK.CPUProfileDataModel(jsProfile);
// var bottomUpDataGrid = new Profiler.BottomUpProfileDataGridTree(null, null, procJsProfile.root, procJsProfile.total)


// var minChildren = bottomUpDataGrid.children.map((child)=>{
//     var children = child.profileNode.children.map((child2)=>{
//         return child2.callUID;
//         })
//     return {self:child.self, total: child.total, callUID: child.callUID, functionName: child.functionName,
//  url: child.url, raw: child.profileNode.callFrame, children: children}})

// fs.writeFileSync(process.argv[3], JSON.stringify(minChildren));

var cpuProfileParser = function(input,plt){
    var procJsProfile = new SDK.CPUProfileDataModel(input,plt);
    var bottomUpDataGrid = new Profiler.BottomUpProfileDataGridTree(null, null, procJsProfile.root, procJsProfile.total)

    return {raw: procJsProfile, parsed: bottomUpDataGrid};
}

module.exports = {
    cpuProfileParser:cpuProfileParser
}


