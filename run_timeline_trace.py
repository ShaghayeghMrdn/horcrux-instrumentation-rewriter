#!/usr/bin/env python
"""
This module runs the timeline-trace.js node file
If the device type is android then the module will start the adb server
and also remotely run chrome instance on android

"""

__license__ = "GPL"
__version__ = "1.0.1"
__maintainer__ = "Ayush Goel"
__email__ = "goelayu@umich.edu"

from Naked.toolshed.shell import execute_js
import argparse
import subprocess
import time
import os

ANDROID_CHROME_INSTANCE = 'com.android.chrome/com.google.android.apps.chrome.Main'
ANDROID_CHROME_USER_PATH = ' /data/user/0/com.android.chrome/*'


def wait_timeout(proc, seconds, output, url, iter):
    """Wait for a process to finish, or raise exception after timeout"""
    start = time.time()
    end = start + seconds
    interval = min(seconds / 1000.0, .25)

    while True:
        result = proc.poll()
        if result is not None:
            return result
        if time.time() >= end:
            proc.kill()
            print "Killing trace script. Timeout.."
            
            garbage_collection(output,url,iter)
            #Kill the chrome instance
            try:
                pidData = open(output + "/chrome.pid","r")
                chromePid = pidData.readlines()[0]
                subprocess.Popen("kill -9 " + chromePid, shell=True)
                print "Killed chrome orphan instance.."
            except IOError as e:
                print e
        time.sleep(interval)

def garbage_collection(path, url,iter):
    print "Deleting any intermediate result.."
    for i in range(iter+1):
        pathToDelete = os.path.join(path,str(i), url[7:])
        print "GC: " + pathToDelete
        try:
            subprocess.Popen("rm -r {0}".format(pathToDelete),shell=True)
        except OSError as e:
            print e 


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('urls', help="path to the list of urls")
    parser.add_argument('output', help="path to the output directory")
    parser.add_argument('device', help="device to run chrome tracer run")
    parser.add_argument('num_repetitions', type=int)
    parser.add_argument('--cold-cache',help="Run chrome with a cold cache",action='store_true' )
    args = parser.parse_args()

    # Clear the user-directory if running with cold cache
    if args.cold_cache and args.device =="mac":
        subprocess.Popen("rm -r TMPDIR", shell=True)
    elif args.cold_cache and args.device=="android":
        subprocess.Popen("adb shell pm clear com.android.chrome", shell=True)
    # If device is android, enable tcp port forwarding
    if args.device == "android":
        cmd_base = 'adb forward tcp:{0} localabstract:chrome_devtools_remote'
        cmd = cmd_base.format(9222)
        p = subprocess.Popen(cmd, shell=True)

    with open(args.urls, 'r') as f:
        listOfUrls = f.readlines()
        # start chrome on mobile device

        # for url in listOfUrls:
        while len(listOfUrls) > 0:
            url = listOfUrls.pop(0)
            for iter in range(args.num_repetitions):
                if args.device == "android":

                    cmd_base = 'adb shell "am start -a android.intent.action.VIEW -n {0} -d about:blank"'
                    cmd = cmd_base.format(ANDROID_CHROME_INSTANCE)
                    p = subprocess.Popen(cmd, shell=True)
                    time.sleep(3)

                # if iter == 0:
                #     #clearing the cache for the first iteration
                #     cmd = 'adb shell "su -c \"rm -rf /data/user/0/com.android.chrome/*\""'
                #     subprocess.Popen(cmd, shell=True)
                    
                nodeProc = subprocess.Popen("node timeline-trace.js -u " + url.strip() + " -o " +
                           args.output + "/" + str(iter) + " -d " + args.device, shell=True)
                wait_timeout(nodeProc, 85, args.output, url, iter)
                if nodeProc.poll() != 0:
                    # listOfUrls.append(url)
                    break


