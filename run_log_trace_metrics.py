#!/usr/bin/env python

"""
This module runs the log-trace-metrics.js node file
param1: Path to the top level directory containing all the traces
param2: path of the output directory

"""

__license__ = "GPL"
__version__ = "1.0.1"
__maintainer__ = "Ayush Goel"
__email__ = "goelayu@umich.edu"

import os
import json
import argparse
from Naked.toolshed.shell import execute_js

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('trace', help="path to the list of traces")
    parser.add_argument('output', help="path to the output directory")
    args = parser.parse_args()

    for root, folder, file in os.walk(args.trace):
        if len(file) >= 1:
            with open(os.path.join(root, file[0]), 'r') as traceFile:
                try:
                    json.load(traceFile)
                    execute_js("log-trace-metrics.js",
                               "-p " + traceFile.name + " -o " +
                               os.path.join(args.output, traceFile.name))
                except ValueError, e:
                    print "Invalid jason file " + root + "/" + os.path.join(
                        root, file[0]) + " hencing skipping"
