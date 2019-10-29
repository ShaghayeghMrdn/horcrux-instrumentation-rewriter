
var fs = require('fs')
var DevtoolsTimelineModel = require('devtools-timeline-model');
var util = require('util');

var program = require('commander');
var mkdirp = require('mkdirp');

program
    .option('-p, --path [path]' , 'path to the trace')
    .option('-o , --output [output-dir]','path to the output directory for results','./parsedTrace')
    .parse(process.argv)

// console.log(process.argv);
var filename = program.path;

function dumpTree(tree, timeValue) {
  var result = new Map();
  tree.children.forEach((value, key) => result.set(key, value[timeValue].toFixed(1)));
  return result;
}

function report(filename) {
  var events = fs.readFileSync(filename, 'utf8');

  var model = new DevtoolsTimelineModel(events);

  // console.group(filename);

  // console.log('Timeline model events:\n', model.timelineModel().mainThreadEvents().length);
  // console.log('IR model interactions\n', model.interactionModel().interactionRecords().length);
  // console.log('Frame model frames:\n', model.frameModel().frames().length);
  // console.log('Filmstrip model screenshots:\n', model.filmStripModel().frames().length);
  // dumpScreenshot(model.filmStripModel());

  // var topDown = model.topDown();
  // console.log('Top down tree total time:\n', topDown.totalTime);
  // console.log('Top down tree, not grouped:\n', dumpTree(topDown, 'totalTime')); // totaltiime is the time spent in the activity and all of it's children

  // console.log('Bottom up tree leaves:\n', [...model.bottomUp().children.entries()].length);
  // var bottomUpURL = model.bottomUpGroupBy('URL');
  // var secondTopCost = [...bottomUpURL.children.values()][1];
  // console.log('bottom up tree, grouped by URL', dumpTree(bottomUpURL, 'selfTime')); // self time is the time spent on that activity alone
  // console.log('Bottom up tree, grouped, 2nd top URL:\n', secondTopCost.totalTime.toFixed(2), secondTopCost.id);

  // var bottomUpSubdomain = model.bottomUpGroupBy('Subdomain');
  // console.log('Bottom up tree, grouped by top subdomain:\n', dumpTree(bottomUpSubdomain, 'selfTime'));

  // var bottomUpByName = model.bottomUpGroupBy('EventName');
  // console.log('Bottom up tree grouped by EventName:\n', dumpTree(bottomUpByName, 'selfTime'));

  mkdirp(program.output , function(err) {
        if (err) console.log("Error file creating directory",err)
        else {
          program.output && fs.writeFileSync(program.output + "/PerCategory", util.inspect(dumpTree(model.bottomUpGroupBy('Category'), 'selfTime')))
          program.output && fs.writeFileSync(program.output + "/PerActivity", util.inspect(dumpTree(model.bottomUpGroupBy('EventName'), 'selfTime')))
          var map = dumpTree(model.bottomUpGroupBy('Category'), 'selfTime');
          var total = Array.from(map.values()).reduce((curr,acc)=>{return parseFloat(acc) + parseFloat(curr)},0);
          process.stdout.write(util.format(total));
      }
    });
  console.groupEnd(filename);
}

report(filename)