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

ANDROID_CHROME_INSTANCE = 'com.android.chrome/com.google.android.apps.chrome.Main'

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('urls', help="path to the list of urls")
    parser.add_argument('output', help="path to the output directory")
    parser.add_argument('device', help="device to run chrome tracer run")
    args = parser.parse_args()

    # If device is android, enable tcp port forwarding
    if args.device == "android":
        cmd_base = 'adb forward tcp:{0} localabstract:chrome_devtools_remote'
        cmd = cmd_base.format(9222)
        p = subprocess.Popen(cmd, shell=True)

    with open(args.urls, 'r') as f:
        listOfUrls = f.readlines()
        # start chrome on mobile device

        for url in listOfUrls:
            if args.device == "android":

                cmd_base = 'adb shell am force-stop {0}'
                cmd = cmd_base.format(ANDROID_CHROME_INSTANCE)
                subprocess.call(cmd, shell=True)

                cmd_base = 'adb shell "am start -a android.intent.action.VIEW -n {0}"'
                cmd = cmd_base.format(ANDROID_CHROME_INSTANCE)
                p = subprocess.Popen(cmd, shell=True)

            execute_js("timeline-trace.js", "-u " + url.strip() + " -o " +
                       args.output + " -d " + args.device)
