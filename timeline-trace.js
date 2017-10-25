var fs = require('fs');
var readline = require('readline');
var Chrome = require('chrome-remote-interface');
var chromeLauncher = require('chrome-launcher');

var TRACE_CATEGORIES = ["-*", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "toplevel", "blink.console", "disabled-by-default-devtools.timeline.stack", "disabled-by-default-devtools.screenshot", "disabled-by-default-v8.cpu_profile", "disabled-by-default-v8.cpu_profiler", "disabled-by-default-v8.cpu_profiler.hires"];

var rawEvents = [];

var program = require('commander');
var mkdirp = require('mkdirp');

program
    .version("0.1.0")
    .option('-u, --url [url]', "The url to be traced")
    .option('-o , --output [output-dir]','path to the output directory for results','./trace')
    .option('-d , --device [device]','Device to run chrome on')
    .parse(process.argv)

function getChromeTrace(url,launcher){

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

            Page.navigate({'url': url});

            Page.loadEventFired(function () {
               Tracing.end()
            });
            // });

            Tracing.tracingComplete(function () {
                var file = program.output + "/" + url.substring(7,) + '/';
                mkdirp(file , function(err) {
                    if (err) console.log("Error file creating directory",err)
                    else {
                         fs.writeFileSync(file + Date.now(), JSON.stringify(rawEvents, null, 2));
                         console.log('Trace file: ' + file + Date.now());
                    }
                })
                chrome.close();
                if (launcher) launcher.kill();
            });

            Tracing.dataCollected(function(data){
                var events = data.value;
                rawEvents = rawEvents.concat(events);
            });

        }
        }).on('error', function (e) {
            console.error('Cannot connect to Chrome' + url, e);
        });
}

function launchChrome(url){
    console.log("Tracing url:" + url)
    if (program.device == "mac") {
        chromeLauncher.launch({
        port: 9222,
        chromeFlags: [
            '--headless',
            '--remote-debugging-port=9222',
            '--user-data-dir=$TMPDIR/chrome-profiling',
            '--no-default-browser-check'
            ]
        }).then((launcher) => {
            getChromeTrace(url, launcher)
        });
    } else {
        getChromeTrace(url)
    }
}

// urlList.on('line', (line) => {
//     console.log("read url from line: " + line)
//     launchChrome(line);
// });

launchChrome(program.url);




