var fs = require('fs');
var readline = require('readline');
var Chrome = require('chrome-remote-interface');
const { exec } = require('child_process');

var TRACE_CATEGORIES = ["-*", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "toplevel", "blink.console", "disabled-by-default-devtools.timeline.stack", "disabled-by-default-devtools.screenshot", "disabled-by-default-v8.cpu_profile", "disabled-by-default-v8.cpu_profiler", "disabled-by-default-v8.cpu_profiler.hires"];

var rawEvents = [];

var program = require('commander');

program
    .version("0.1.0")
    .option('-u, --urls [list-of-urls]', "Path to file containing the list of urls")
    .option('-o , --output [output-dir]','path to the output directory for results','./')
    .parse(process.argv)

var urlList = readline.createInterface({
  input: fs.createReadStream(program.urls)
});

// exec('/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=$TMPDIR/chrome-profiling --no-default-browser-check', (err, stdout, stderr) => {
//   if (err) {
//     // node couldn't execute the command
//     return;
//   }

//   console.log(`stdout: ${stdout}`);
//   console.log(`stderr: ${stderr}`);
// });


Chrome(function (chrome) {
    with (chrome) {
        Page.enable();
        Network.enable();

        // Disable cache (wonder if this works better than the browser...) 
        // Answer: it seems to work better from the eye ball test
        Network.setCacheDisabled({cacheDisabled: true});


        // urlList.on('line', (line) => {
        Tracing.start({
            "categories":   TRACE_CATEGORIES.join(','),
            "options":      "sampling-frequency=10000"  // 1000 is default and too slow.
        });

        Page.navigate({'url': 'http://paulirish.com'});

        Page.loadEventFired(function () {
           Tracing.end()
        });
        // });

        Tracing.tracingComplete(function () {
            var file = program.output + '/profile-' + Date.now() + '.devtools.trace';
            fs.writeFileSync(file, JSON.stringify(rawEvents, null, 2));
            console.log('Trace file: ' + file);

            chrome.close();
        });

        Tracing.dataCollected(function(data){
            var events = data.value;
            rawEvents = rawEvents.concat(events);
        });

    }
}).on('error', function (e) {
    console.error('Cannot connect to Chrome', e);
});