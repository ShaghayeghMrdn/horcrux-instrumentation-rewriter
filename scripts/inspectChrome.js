var Chrome = require('chrome-remote-interface');
var chromeLauncher = require('chrome-launcher');
var {spawnSync} = require('child_process');
var fs = require('fs')
var mkdirp = require('mkdirp')
var program = require('commander')

console.log(process.argv);

program
	.option('-u, --url [url] ','the url to replay')
	.option('-l, --launch' , 'launch chrome')
	.option('-o, --output [output]',' the path to the output directory')
	.option('-j, --js-profiling','enable js profiling of the webpages')
	.option('-plt', 'extract page load time')
	.option('-c, --custom', 'extract custom information')
	.parse(process.argv)

pageLoadTime = {}
function navigate(launcher){
	Chrome(function (chrome) {
		with (chrome) {
			Page.enable();
			Profiler.enable();
			Runtime.enable();

			if (program.jsProfiling) 
				Profiler.start()

			if (program.url && program.launch)
				Page.navigate({'url':program.url});
			
			//if (program.custom) {
                        //        extractInvocationInformation(Runtime, chrome, launcher,1, Page, program.url);
                        //}
			var count=0;

			Page.loadEventFired(function () {
			   console.log("Load event fired");
			   if (program.jsProfiling) {	
				Profiler.stop().then( (data) => {
			//	if (process.argv[2] == "-p") {
					mkdirp(process.argv[4], function(err){
						if (err) console.log(err); 
						fs.writeFileSync(process.argv[4] + "/jsProfile", JSON.stringify(data.profile));
					        console.log("Page load fired");
						chrome.close();
						launcher.kill();	
						spawnSync('ps aux | grep chromium-browser | awk "{print $2}" | xargs kill -9', {shell:true}); 
					});
				//}
				});
			   } 
			   if (program.custom && count<2) {
					count++;
			   		extractInvocationInformation(Runtime, chrome, launcher,Page, count);
			   }

			});
		}
	}).on('error', function(er){
		console.log("can't connect to chrome", er);
	});
}

function extractInvocationInformation(Runtime, chrome, launcher, Page,iter){
	var keys = [];
	var invocations = {};
	var errors = [];
        Runtime.evaluate({expression:'console.log("ayuish");'});

	Runtime.evaluate({expression:'Object.keys(window.sigStack)', returnByValue: true}, (err, result) => {
		keys = result["result"]["value"]
	
		console.log("Number of invocations: ", keys.length);
		keys.forEach(function(key, index){
			//Runtime.evaluate({expression:`console.log('${key}')`});

			key  = escapeBackSlash(key);
			Runtime.evaluate({expression:`window.sigStack['${key}']`, returnByValue: true}, (err, result) => {
				if (!err) {
					invocations[key] = result["result"]["value"];
				} else {
					//console.log("Error on idex " , key, err);
					errors.push(index);
				}
				if (index % 100 == 0) {
					console.log(index/keys.length*100, "% done...");
				}
				//console.log("current index is", key, index, result);
				if (index == keys.length -1) {
					    fs.writeFileSync(program.output + "/invocations" + iter, JSON.stringify(invocations));
				            fs.writeFileSync(program.output + "/errors"+iter, JSON.stringify(errors));
				            //chrome.close();
			                    //if (launcher) launcher.kill();
					    console.log("Done with the load");
				     	    if (iter == 1 ) Page.reload();
					    if (iter ==2 ) {
						console.log("Exiting node process..");
						chrome.close();
						if (launcher) launcher.kill();
					    }
				}
			})
	
		});
	});	
}
function escapeBackSlash(str){
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\^\$\|\'\_]/g, "\\$&");
}

function extractPageLoadTime(Runtime,callback){
    Runtime.evaluate({expression: 'performance.timing.navigationStart'}).then( (result, err) => {
            pageLoadTime["startTime"] = result["result"]["value"]
        });
    Runtime.evaluate({expression: 'performance.timing.loadEventEnd'}).then( (result, err) => {
            pageLoadTime["endTime"] = result["result"]["value"]
            pageLoadTime["loadTime"] = pageLoadTime["endTime"] - pageLoadTime["startTime"];
        });
    Runtime.evaluate({expression: 'performance.timing.domContentLoadedEventEnd'}).then((result, err) => {
            pageLoadTime["domContentLoaded"] = result["result"]["value"]
	    callback();
        });
}


if (program.launch) {
chromeLauncher.launch({
	port:9222,
	chromeFlags: [
		'--ignore-certificate-errors',
	]
}).then(chrome => {
	navigate(chrome);
});
} else {
	navigate(); 
}
