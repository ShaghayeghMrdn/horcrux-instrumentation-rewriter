const puppeteer = require('puppeteer');

program
    .option('-u, --url [url] ','the url to replay')
    .option('-o, --output [output]',' the path to the output directory')
    .option('-j, --js-profiling','enable js profiling of the webpages')
    .option('-plt', 'extract page load time')
    .option('-t, --tracing','extract tracing information')
    .option('-c, --custom', 'extract custom information')
    .option('-p,--port [port]', 'port for chrome')
    .option('--log', 'extract console log')
    .option('--coverage', 'extract coverage information')
    .option('-n, --network','extract network information')
    .parse(process.argv)


async function main(){
    
}