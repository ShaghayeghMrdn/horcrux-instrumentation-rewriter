var Chrome = require('chrome-remote-interface');
var chromeLauncher = require('chrome-launcher');
var {spawnSync} = require('child_process');
var fs = require('fs')
var mkdirp = require('mkdirp')
var program = require('commander')
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
	.option('-n, --network','extract network information')
	.parse(process.argv)

pageLoadTime = {}
consoleLog = [];
consoleLog2 = [];
NetworkLog = [];
spinOnCustom = true;
function navigate(launcher){
	// console.log(program.port);
	Chrome({port:Number(program.port)},function (chrome) {
		with (chrome) {
			Page.enable();
			Profiler.enable();
			Runtime.enable();
			Network.enable();
			Log.enable();

			if (program.jsProfiling) 
				Profiler.start()

			if (program.url)
				Page.navigate({'url':program.url});
			
			if (program.tracing)
				Tracing.start({
					'categories': TRACE_CATEGORIES.join(','),
					'options': 'sampling-frequency=10000'
				});

			if (program.network){
				NetworkEventHandlers(Network, program.output + "/network");
			}
			var count=0;
			var rawEvents = [];
			Tracing.dataCollected(function(data){
                var events = data.value;
                rawEvents = rawEvents.concat(events);
            });
            
            Tracing.tracingComplete().then(function () {
                console.log("tracing complete callback fired");
                
                        // console.log(rawEvents.length);
                 fs.writeFileSync(program.output + '/Timeline.trace', JSON.stringify(rawEvents,null,2));
		   		setTimeout(function(){

		   			console.log("Final wait over..");
			   		
			   		spawnSync("ps aux | grep " +  program.port + " | awk '{print $2}' | xargs kill -9",{shell:true});
			   		a=spawnSync("ps aux | grep replayshell | awk '{print $2}' | xargs kill -9",{shell:true});
			   		// console.log("Killed the replayshell", JSON(a));
			   		chrome.close();
			   	}, 1000);
                // 
                
            });

            Runtime.exceptionThrown(function(entry){
            	consoleLog.push(entry);
            })
	    Log.entryAdded((entry)=>{consoleLog.push(entry)})

			Page.loadEventFired(function () {
			   console.log("Load event fired");
			   Network.disable();
			   if (program.network) writeFileSync(program.output + "/network", JSON.stringify(NetworkLog));
			   extractPageLoadTime(Runtime,chrome, launcher);
			   if (program.tracing && count == 0) {
			   		Tracing.end();
			   }
			   if (program.custom) {
			   		extractInvocationInformation(Runtime, chrome, launcher,Page, count);
			   }
			   if (program.log)  { 
			   	fs.writeFileSync(program.output + "/logs", JSON.stringify(consoleLog));
			   	console.log("Console data logged");
			   }
			   if (program.jsProfiling) {
			   	Profiler.stop().then(data => {
			   		fs.writeFileSync(program.output + "/jsProfile", JSON.stringify(data.profile));
			   		console.log("Profiler data logged")
			   	});
			   }
			   // } else {
			   	// setTimeout(
			   	// 	function(){
			   	// 		console.log("Waited for about few seconds after page load");
			   			
			   	// 		chrome.close();
			   	// 		spawnSync("ps aux | grep " +  program.port + " | awk '{print $2}' | xargs kill -9",{shell:true});
			   	// 		spawnSync("ps aux | grep replayshell | awk '{print $2}' | xargs kill -9",{shell:true});
			   	// 	}, 3000);
			   // }


			});
		}
	}).on('error', function(er){
		console.log("can't connect to chrome", er);
	});
}

function NetworkEventHandlers(Network, file){
    console.log("Network trace file: " + file)
    mkdirp(file.split('/').slice(0,-1).join('/'), function (err) {
        if (err)
            console.log("Error creating the network file path")
        else {
                Network.requestWillBeSent(function(data){
                	NetworkLog.push(data)
                    // fs.appendFileSync(file, JSON.stringify({"Network.requestWillBeSent":data}));
                    // console.log("data received")
                });
                console.log("Network handler registered");
                // Network.requestServedFromCache(function(data){
                //     fs.appendFileSync(file, JSON.stringify({"Network.requestServedFromCache":data})+"\n");
                // });

                // Network.responseReceived(function(data){
                //     fs.appendFileSync(file, JSON.stringify({"Network.responseReceived":data})+"\n");
                // });

                // Network.dataReceived(function(data){
                //     fs.appendFileSync(file, JSON.stringify({"Network.dataReceived":data})+"\n");
                // });

                // Network.loadingFinished(function(data){
                //     fs.appendFileSync(file, JSON.stringify({"Network.loadingFinished":data})+"\n");
                // });
        }
    });

}

function extractPageLoadTime(Runtime, chrome, launcher){
	console.log("Starting to  extract page load time");
    Runtime.evaluate({expression: 'performance.timing.navigationStart'}).then( (result, err) => {
            pageLoadTime["startTime"] = result["result"]["value"]
        });
    Runtime.evaluate({expression: 'performance.timing.loadEventEnd'}).then( (result, err) => {
            pageLoadTime["endTime"] = result["result"]["value"]
            pageLoadTime["loadTime"] = pageLoadTime["endTime"] - pageLoadTime["startTime"];
        });
    Runtime.evaluate({expression: 'performance.timing.domContentLoadedEventEnd'}).then((result, err) => {
            pageLoadTime["domContentLoaded"] = result["result"]["value"]
            console.log("Done extracting page load times");
            fs.writeFileSync(program.output + "/plt", JSON.stringify(pageLoadTime));
            // setTimeout(function(){
		    	// chrome.close();
		    	// spawnSync("ps aux | grep " +  program.port + " | awk '{print $2}' | xargs kill -9",{shell:true});
            	// spawnSync("ps aux | grep apache2 | awk '{print $2}' | xargs kill -9",{shell:true});
           		// spawnSync("ps aux | grep replayshell | awk '{print $2}' | xargs kill -9",{shell:true});
	    // }, 3000);
        });
}

function extractInvocationInformation(Runtime, chrome, launcher, Page,iter){
	console.log("Starting to extract custom data since page loaded");
	var keys = [];
	var errors = [];
	var processedSignature = {};
        Runtime.evaluate({expression:'console.log("ayush");'});
    var expression = 'Object.keys(__tracer.getProcessedSignature())'
	Runtime.evaluate({expression:expression, returnByValue: true}, (err, result) => {
		keys = result['result']['value'];

		try {
			 keys.forEach(function(key, index){
			 	//Runtime.evaluate({expression:`console.log('${key}')`});
			 	//invocations[key] = [];
			 	key  = escapeBackSlash(key);
			 	Runtime.evaluate({expression:`__tracer.getProcessedSignature()['${key}']`, returnByValue: true}, (err, result) => {
			 		if (!err) {
			 			processedSignature[key] = result["result"]["value"];
			 		} else {
			 			//console.log("Error on idex " , key, err);
			 			errors.push(index);
			 		}
			 		if (index % 100 == 0) {
			 			console.log(index/keys.length*100, "% done...");
			 		}

			 		// console.log("current index is", keys.length, index, result);
			 		if (index == keys.length -1) {
			 			    fs.writeFileSync(program.output + "/Signature" + iter, JSON.stringify(processedSignature));
			 		            fs.writeFileSync(program.output + "/errors"+iter, JSON.stringify(errors));
			 		            //chrome.close();
			 	                    //if (launcher) launcher.kill();
			 			    console.log("Done with signature extraction");
						    spinOnCustom = false;
			 		}
			 	})

			 });
		} catch (e){
			console.log(e);
			spawnSync("ps aux | grep " + program.port + " | awk '{print $2}' | xargs kill -9",{shell:true});
		}
	});	
}

function escapeBackSlash(str){
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\^\$\|\'\_]/g, "\\$&");
}


if (program.launch) {
	// console.log(program.port)
chromeLauncher.launch({
	port:Number(program.port),
	chromeFlags: [
		'--ignore-certificate-errors',
		 //'--headless',
		 '--user-data-dir=/tmp/nonexistent' + (new Date).getTime(),
	]
}).then(chrome => {
	console.log("chrome is launched, navigating page");
	navigate(chrome);
});
} else {
	spawnSync("chromium-browser --remote-debugging-port=9222 --ignore-certificate-errors --user-data-dir=/tmp/nonexistent$(date +%s%N) ; sleep 6");
	console.log("chrome launched");
	navigate(); 
}

