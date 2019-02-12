var Chrome = require('chrome-remote-interface');
var chromeLauncher = require('chrome-launcher');
var {spawnSync} = require('child_process');
var fs = require('fs')
var mkdirp = require('mkdirp')
var program = require('commander')
var customCodes = require('./custom.js');
//var TRACE_CATEGORIES = ["Blob","FileSystem","IndexedDB","ServiceWorker","ValueStoreFrontend::Backend","WebCore,benchmark,rail","audio","benchmark","benchmark,latencyInfo,rail","benchmark,rail","blink","blink,benchmark","blink,benchmark,rail,disabled-by-default-blink.debug.layout","blink,blink_style","blink,devtools.timeline","blink,loader","blink,loading","blink,rail","blink.animations,devtools.timeline,benchmark,rail","blink.console","blink.net","blink.user_timing","blink.user_timing,rail","blink_gc","blink_gc,devtools.timeline","browser","browser,navigation","browser,startup","cc","cc,benchmark","cc,disabled-by-default-devtools.timeline","cdp.perf","content","devtools","devtools.timeline","devtools.timeline,rail","devtools.timeline,v8","devtools.timeline.async","disabled-by-default-blink.debug","disabled-by-default-blink.debug.layout","disabled-by-default-blink.debug.layout.trees","disabled-by-default-blink.feature_usage","disabled-by-default-blink.image_decoding","disabled-by-default-blink.invalidation","disabled-by-default-blink_gc","disabled-by-default-cc.debug","disabled-by-default-cc.debug,disabled-by-default-cc.debug.quads,disabled-by-default-devtools.timeline.layers","disabled-by-default-cc.debug.cdp-perf","disabled-by-default-cc.debug.display_items","disabled-by-default-cc.debug.display_items,disabled-by-default-cc.debug.picture,disabled-by-default-devtools.timeline.picture","disabled-by-default-cc.debug.overdraw","disabled-by-default-cc.debug.quads","disabled-by-default-cc.debug.scheduler","disabled-by-default-cc.debug.scheduler.frames","disabled-by-default-cc.debug.scheduler.now","disabled-by-default-cc.debug.triangles","disabled-by-default-compositor-worker","disabled-by-default-devtools.timeline","disabled-by-default-devtools.timeline.frame","disabled-by-default-devtools.timeline.invalidationTracking","disabled-by-default-file","disabled-by-default-gpu.debug","disabled-by-default-gpu.device","disabled-by-default-gpu.service","disabled-by-default-gpu_decoder","disabled-by-default-ipc.flow","disabled-by-default-loading","disabled-by-default-memory-infra","disabled-by-default-net","disabled-by-default-network","disabled-by-default-renderer.scheduler","disabled-by-default-renderer.scheduler.debug","disabled-by-default-skia","disabled-by-default-skia.gpu","disabled-by-default-skia.gpu.cache","disabled-by-default-system_stats","disabled-by-default-toplevel.flow","disabled-by-default-v8.compile","disabled-by-default-v8.cpu_profiler","disabled-by-default-v8.cpu_profiler.hires","disabled-by-default-v8.gc","disabled-by-default-v8.gc_stats","disabled-by-default-v8.ic_stats","disabled-by-default-v8.runtime","disabled-by-default-v8.runtime_stats","disabled-by-default-v8.runtime_stats_sampling","disabled-by-default-worker.scheduler","disabled-by-default-worker.scheduler.debug","gpu","gpu,startup","identity","input","input,benchmark","input,benchmark,devtools.timeline","input,benchmark,rail","input,rail","io","ipc","ipc,toplevel","leveldb","loader","loading","loading,devtools.timeline","loading,rail,devtools.timeline","media","mojom","navigation","navigation,benchmark,rail","navigation,rail","net","netlog","omnibox","rail","renderer","renderer,benchmark,rail","renderer.scheduler","renderer_host","renderer_host,navigation","sandbox_ipc","service_manager","shutdown","skia","startup","startup,benchmark,rail","startup,rail","task_scheduler","test_gpu","test_tracing","ui","v8","v8,devtools.timeline","v8.execute","views","viz"];

var TRACE_CATEGORIES = ["-*", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "toplevel", "blink.console", "disabled-by-default-devtools.timeline.stack", "disabled-by-default-devtools.screenshot", "disabled-by-default-v8.cpu_profile", "disabled-by-default-v8.cpu_profiler", "disabled-by-default-v8.cpu_profiler.hires"];


console.log(process.argv);

program
	.option('-u, --url [url] ','the url to replay')
	.option('-l, --launch' , 'launch chrome')
	.option('-o, --output [output]',' the path to the output directory')
	.option('-j, --js-profiling','enable js profiling of the webpages')
	.option('-plt', 'extract page load time')
	.option('-t, --tracing','extract tracing information')
	.option('-c, --custom', 'extract custom information')
	.option('-p,--port [port]', 'port for chrome')
	.option('--log', 'extract console log')
    .option('--coverage', 'extract coverage information')
	.option('-n, --network','extract network information')
    .option('-m, --mobile','running chrome on mobile')
    .option('-e, -error [errpr]','file containing errorous urls')
    .option('--sim [sim]','enable network simulation')
	.parse(process.argv)

pageLoadTime = {}
consoleLog = [];
consoleLog2 = [];
NetworkLog = [];
spinOnCustom = true;
function navigate(launcher){
	let local = false;
    if (program.mobile)
        local = true;
	Chrome({port:Number(program.port), local: local},async function (chrome) {
		with (chrome) {
			await Page.enable();
			await Profiler.enable();
			await Runtime.enable();
			await Network.enable();
			await Log.enable();

            let errFile = null;
            if (program.error){
                errFile = fs.readFileSync(program.error,'utf-8').split('\n');
                if (errFile.indexOf(program.url) >=0 ){
                    console.log("Exiting because this is an errornous url as observed in past");
                    chrome.close();
                    process.exit();
                }
            }
            /*
            Set time out to detect crashes.
            In case of a crash dump whatever information is available, specially crash logs
            */
            setTimeout(function(){
                console.log("Timer fired, website crashed");
                if (program.log) {
                    fs.writeFileSync(program.output + "/logs", JSON.stringify(consoleLog));
                    console.log("Console data logged");
                };
                // Push the url in the errFile before exiting
                fs.appendFileSync("./" + program.error, program.url);
                chrome.close();
                spawnSync("ps aux | grep " +  program.port + " | awk '{print $2}' | xargs kill -9",{shell:true});
            }, 85000)

            if (program.sim){
                var simConfig = JSON.parse(fs.readFileSync(program.sim, "utf-8"));
                console.log("Loading sim data: " + JSON.stringify(simConfig))
                Network.emulateNetworkConditions(simConfig);
                Network.setUserAgentOverride({userAgent: "Mozilla/5.0 (Linux; Android 8.0.0; Pixel 2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.99 Mobile Safari/537.36"});
                Emulation.setDeviceMetricsOverride({width:411, height: 731, mobile:true, deviceScaleFactor:0 })

            }

            // Network.emulateNetworkConditions({offline:false, latency:40, downloadThroughput:1000 * 1024/8, uploadThroughput:750 * 1024/8,connectionType: "cellular4g"})


			if (program.jsProfiling) 
				await Profiler.start()
			
			if (program.tracing)
				await Tracing.start({
					'categories': TRACE_CATEGORIES.join(','),
					'options': 'sampling-frequency=10000'
				    });

			if (program.network){
				NetworkEventHandlers(Network, program.output + "/network");
			}

            if (program.coverage)
                await Profiler.startPreciseCoverage({'callCount': false, 'detailed': true });

			var count=0;
			var rawEvents = [];

			Tracing.dataCollected(function(data){
                var events = data.value;
                rawEvents = rawEvents.concat(events);
            });
            

            Runtime.exceptionThrown(function(entry){
            	consoleLog.push(entry);
            })

            Runtime.consoleAPICalled((entry) =>{
                //Don't log regular console messages
                // consoleLog.push(entry);
            })

            Log.entryAdded((entry)=>{
                // consoleLog.push(entry)
            })

            if (program.url) {
                await Page.navigate({'url':program.url});
                console.log("Page navigated");
            }

            await Page.loadEventFired();
            console.log("First load event fired");
            await extractPageLoadTime(Runtime, "/plt");

            if (program.coverage) {
                var _coverageData = await Profiler.takePreciseCoverage();
                var coverageData = _coverageData.result;
                await Profiler.stopPreciseCoverage();

                fs.writeFileSync(program.output + "/coverage" , JSON.stringify(coverageData, null, 2));
                console.log("Coverage data logged");
            }

            if (program.tracing) {
                await Tracing.end();
                await Tracing.tracingComplete();
                fs.writeFileSync(program.output + '/Timeline.trace', JSON.stringify(rawEvents,null,2));
                console.log("Tracing data logged");
            }

            // if (program.network) 
            //     fs.writeFileSync(program.output + "/network", JSON.stringify(NetworkLog));

            if (program.custom) {
                   await customCodes.getCacheStats(Runtime, program.output);
                   await customCodes.getCustomStat('__tracer.getNonCacheableFunctions()', Runtime, program.output + "/noncache");
                   await customCodes.getCustomStat('__tracer.getCallGraph()', Runtime, program.output + "/callgraph");
                   await customCodes.getCacheSize(Runtime, program.output);
                   // await customCodes.getFunctionStats(Runtime, program.output);
                   // await extractInvocationInformation(Runtime, chrome, launcher,Page, count);
                   console.log("Custom data logged");
               }

            if (program.log) {
                fs.writeFileSync(program.output + "/logs", JSON.stringify(consoleLog));
                console.log("Console data logged");
            }

            if (program.jsProfiling) {
                var _profilerData = await Profiler.stop(); 
                fs.writeFileSync(program.output + "/jsProfile", JSON.stringify(_profilerData.profile));
                console.log("Profiler data logged")
            }

            spawnSync("ps aux | grep " +  program.port + " | awk '{print $2}' | xargs kill -9",{shell:true});
            // a=spawnSync("ps aux | grep replayshell | awk '{print $2}' | xargs kill -9",{shell:true});
            chrome.close();
            process.exit();

		}
	}).on('error', function(er){
		console.log("can't connect to chrome", er);
	});
}

// async function getJSCoverage()

async function NetworkEventHandlers(Network, file){
    console.log("Network trace file: " + file)
    await mkdirp(file.split('/').slice(0,-1).join('/'));
    // Network.requestWillBeSent(function(data){
    //     NetworkLog.push(data);
    // });
    Network.requestWillBeSent(function(data){
        fs.appendFileSync(file, JSON.stringify({"Network.requestWillBeSent":data})+"\n");
    });
    Network.requestServedFromCache(function(data){
        fs.appendFileSync(file, JSON.stringify({"Network.requestServedFromCache":data})+"\n");
    });

    Network.responseReceived(function(data){
        fs.appendFileSync(file, JSON.stringify({"Network.responseReceived":data})+"\n");
    });

    Network.dataReceived(function(data){
        fs.appendFileSync(file, JSON.stringify({"Network.dataReceived":data})+"\n");
    });

    Network.loadingFinished(function(data){
        fs.appendFileSync(file, JSON.stringify({"Network.loadingFinished":data})+"\n");
    });

}


async function extractPageLoadTime(Runtime, outputFile){
    var _query  = await Runtime.evaluate({expression: 'performance.timing.navigationStart'})
    pageLoadTime["startTime"] = _query.result.value
    var _query  = await Runtime.evaluate({expression: 'performance.timing.loadEventEnd'})
    pageLoadTime["end"] = _query.result.value
    var _query  = await Runtime.evaluate({expression: 'performance.timing.loadEventStart'})
    pageLoadTime["loadStartTime"] = _query.result.value

    pageLoadTime["loadTime"] = pageLoadTime["end"] - pageLoadTime["startTime"];
    pageLoadTime["actualLoadTime"] = pageLoadTime["loadStartTime"] - pageLoadTime["startTime"];

    console.log("Dump performance timing information to file ");
    fs.writeFileSync(program.output + outputFile, JSON.stringify(pageLoadTime));
}

async function extractInvocationInformation(Runtime, chrome, launcher, Page,iter){
	var keys = [];
	var errors = [];
	var processedSignature = {};
    // var expression = '__tracer.getInvocations();';
    var expression = 'Object.keys(__tracer.getProcessedSignature())';
    var cachedSignature;
    var _query = await Runtime.evaluate({'expression': 'Object.keys(JSON.parse(localStorage.getItem("PageLocalCache"))).length', returnByValue: true});
    if (_query.result.exceptionDetails) {
        console.error("Error while fetching page local cache");
        return;
    }

    cachedSignature = _query.result.value;
  
    var _query = await Runtime.evaluate({expression:expression, returnByValue: true});
    if (_query.result.exceptionDetails) {
        console.error("Error while fetching processed Signature length");
        return;
    }

    keys = _query.result.value;
   
   if (!keys.length) {
    fs.writeFileSync(program.output + "/Signature", JSON.stringify({}, null, 4));
    console.log("No entry in processed Signature");
    return;
   }

    var signatureCallbackRegistered = false;

    console.log("Starting to extract custom data of length "  + keys.length );

    for (var index in keys){
        var key = keys[index];
        signatureCallbackRegistered = true;
    	key  = escapeBackSlash(key);
        var _query;
        try {
    	   _query = await Runtime.evaluate({expression:`__tracer.getProcessedSignature()['${key}']`, returnByValue: true});
        } catch (e) {
            console.log(e);
            continue;
        }

        if (_query.result.exceptionDetails) {
            errors.push(_query.result.exceptionDetails);
            return;
        }

        processedSignature[key] = _query["result"]["value"];

        if (processedSignature[key] && processedSignature[key].reads instanceof Set)
            processedSignature[key].reads = [...processedSignature[key].reads]
        if (processedSignature[key] && processedSignature[key].writes instanceof Set)
            processedSignature[key].writes = [...processedSignature[key].writes]

    	if (index % 100 == 0) {
    		console.log(index/keys.length*100, "% done...");
    	}

    };

    // console.log(processedSignature);
    fs.writeFileSync(program.output + "/Signature", JSON.stringify(processedSignature, null, 4));
    fs.writeFileSync(program.output + "/errors", JSON.stringify(errors));
    fs.writeFileSync(program.output + "/sigstats", JSON.stringify([keys.length, cachedSignature]));
    console.log("Done with signature extraction");

    // setTimeout(function(){
    //     spawnSync("ps aux | grep " +  program.port + " | awk '{print $2}' | xargs kill -9",{shell:true});
    //     a=spawnSync("ps aux | grep replayshell | awk '{print $2}' | xargs kill -9",{shell:true});
    //     chrome.close();
    // }, 1000);

}

function escapeBackSlash(str){
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\^\$\|\'\_]/g, "\\$&");
}


if (program.launch) {
chromeLauncher.launch({
	port:Number(program.port),
	chromeFlags: [
		'--ignore-certificate-errors',
        '--disable-web-security',
        '--disable-extensions ',
		 // '--headless',
         // '--v8-cache-options=off',
         // '--js-flags="--compilation-cache false"',
         // '--user-data-dir=/tmp/chromeProfiles/' + program.url.split('//')[1]
		 '--user-data-dir=/tmp/nonexistent' + (new Date).getTime(),
	]
}).then(chrome => {
	console.log("chrome is launched, navigating page");
	navigate(chrome);
});
} else {
	// spawnSync("chromium-browser --remote-debugging-port=9222 --ignore-certificate-errors --user-data-dir=/tmp/nonexistent$(date +%s%N) ; sleep 6");
	console.log("chrome launched");
	navigate(); 
}

