
# This is a small module just to inspect
# the contents of the protobuf files
# to debug content

import brotli
import http_record_pb2
import argparse
import zlib
import os
import re
import subprocess
import sys
from copy import deepcopy
from Naked.toolshed.shell import execute_js
import json
import unicodedata


def matchRtiWithMahimahi(rtiUrls, mahimahiUrls):
    unmatched = []
    for rtiUrl in rtiUrls:
        # print rtiUrl, len(rtiUrls[rtiUrl])
        foundMatch = False
        for mahimahiUrl in mahimahiUrls:
            if rtiUrl.endswith(mahimahiUrl):
                foundMatch = True
        if not foundMatch:
            unmatched.append(rtiUrl)
    if len(rtiUrls) != 0:
        sys.stdout.write(str(len(unmatched)*100.0/len(rtiUrls)) + " ")
        sys.stdout.flush()

def unchunk(body):
    new_body = ""
    # iterate through chunks until we hit the last chunk
    crlf_loc = body.find('\r\n')
    chunk_size = int( body[:crlf_loc], 16 )
    body = body[crlf_loc+2:]
    while( chunk_size != 0 ):
        # add chunk content to new body and remove from old body
        new_body += body[0:chunk_size]
        body = body[chunk_size:]

        # remove CRLF trailing chunk
        body = body[2:]

        # get chunk size
        crlf_loc = body.find('\r\n')
        chunk_size = int( body[:crlf_loc], 16 )
        body = body[crlf_loc+2:]

    # on the last chunk
    body = body[crlf_loc+2:]

    return new_body

def main(args):

    mahimahiUrls = []
    rtiUrls = {}
    # extract js Urls
    http_response = http_record_pb2.RequestResponse()

    memoize_solutions = ["underscore","memoizee","iMemoized","lodash","fast-memoize"]

    for root, folder, files in os.walk(args.mahimahi):
        scriptsToInstrument = [];
        url = root.split('/')[-2]
        urls = []
        memoizeFiles = 0
        for file in files:
                isJs = False
                gzip = False
                gzipType = 0
                f = open(os.path.join(root,file), "rb")
                # print file
                http_response.ParseFromString(f.read())
                f.close()

                for header in http_response.response.header:
                    if header.key.lower() == "content-type":
                        if "javascript" in header.value.lower() or "html" in header.value.lower():
                            isJs = True
                    if header.key.lower() == "content-encoding":
                        # print "GZIIPED FILE is " , file
                        gzip = True
                        gzipType = header.value
                        # markedToBeDeleted.append(header.key)

                    if header.key.lower() == "transfer-encoding" and header.value == "chunked":
                        http_response.response.body = unchunk(http_response.response.body)

                if isJs:
                    if gzip:
                        try:
                            # print "Decompressing {} ...with type {}".format(file, gzipType)
                            if gzipType.lower() != "br":
                                body = zlib.decompress(bytes(bytearray(http_response.response.body)), zlib.MAX_WBITS|32)
                            else:
                                body = brotli.decompress(http_response.response.body)
                        except zlib.error as e:
                            error=1
                            # print "Corrupted decoding: " + file + str(e)
                            # os._exit(0)
                    else:
                        body = http_response.response.body
                    g = open(os.path.join(args.output,file),"w")
                    g.write(body)
                    g.close()

          

    # print memoizeFiles
    # sys.stdout.write(str(len(urls)))
    # sys.stdout.flush()



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('mahimahi', help='path to input directory')
    parser.add_argument('output',help='path to output directory')
    args = parser.parse_args()
    main(args)