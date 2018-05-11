var Chrome = require('chrome-remote-interface');
var chromeLauncher = require('chrome-launcher');
var {spawnSync} = require('child_process');
var fs = require('fs')
var mkdirp = require('mkdirp')

console.log(process.argv);

function navigate(launcher){
	Chrome(function (chrome) {
		with (chrome) {
			Page.enable();
			Profiler.enable();
			Profiler.start().then(() => {
				Page.navigate({'url':process.argv[2]}); 
			});
			Page.loadEventFired(function () {
				Profiler.stop().then( (data) => {
					mkdirp(process.argv[3], function(err){
						if (err) console.log(err); 
						fs.writeFileSync(process.argv[3] + "/jsProfile", JSON.stringify(data.profile));
					
						chrome.close();
						launcher.kill();	
						spawnSync('ps aux | grep chromium-browser | awk "{print $2}" | xargs kill -9', {shell:true});       
					});
				});
			});
		}
	}).on('error', function(er){
		console.log("can't connect to chrome", er);
	});
}

chromeLauncher.launch({
	port:9222,
	chromeFlags: [
		'--ignore-certificate-errors',
		'--headless'
	]
}).then(chrome => {
	navigate(chrome);
});
