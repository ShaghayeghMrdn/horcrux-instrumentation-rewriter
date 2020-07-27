
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
import hashlib


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

def isJS(headers):
    for header in headers:
        if header.key.lower() == "content-type" and "javascript" in header.value.lower():
            return True

    return False

def isChunked(headers):
    for header in headers:
        if header.key.lower() == "transfer-encoding" and header.value == "chunked":
            return True

    return False

def isZipped(headers):
    for header in headers:
        if header.key.lower() == "content-encoding":
            return header.value
    return False;


def getPlainText(msg):
    orig_body = msg.response.body
    if isChunked(msg.response.header):
        orig_body = unchunk(orig_body)

    isCompressed = isZipped(msg.response.header)
    if isCompressed == "br":
        orig_body = brotli.decompress(orig_body)
    elif isCompressed != False:
        orig_body = zlib.decompress(bytes(bytearray(orig_body)), zlib.MAX_WBITS|32)

    return orig_body

def main(args):

    mahimahiUrls = []
    pairs = []
    rtiUrls = {}
    # extract js Urls
    http_response_orig = http_record_pb2.RequestResponse()
    http_response_mod = http_record_pb2.RequestResponse()
    count = 0
    listOfJS = {}
    for root, folder, files in os.walk(args.original):
        url = root.split('/')[-1]
        listOfJS[url] = []
        count = count+1
        for file in files:
            try:
                f_orig = open(os.path.join(root,file), "rb")
                http_response_orig.ParseFromString(f_orig.read())
                f_orig.close()

                if isJS(http_response_orig.response.header):
                    u = http_response_orig.request.first_line.split()[1]
                    if "site_type" in _u:
                        print http_response_orig.response.header
            except:
                print "error while processing file"
        # print "processed", url
        # if count > 100:
        #     break

    jsData = {}
    count = 0
    print "files from", args.modified
    for root, folder, files in os.walk(args.modified):
        url = root.split('/')[-1]
        # otherJS = {k:listOfJS[k] for k in listOfJS if k != url}
        jsData[url] = [0,0]
        count = count+1
        for file in files:
            try:
                f_orig = open(os.path.join(root,file), "rb")
                http_response_orig.ParseFromString(f_orig.read())

                if isJS(http_response_orig.response.header):
                    # jsData[url][1] = jsData[url][1] + 1
                    _u = http_response_orig.request.first_line.split()[1]
                    if "site_type" in _u:
                        print http_response_orig.response.header, _u
                    # u = _u.split('/')[-1].split('?')[0]
                    # val = []
                    # for i in otherJS.values():
                    #     val.extend(i)
                    # if u in val:
                    #     jsData[url][0] = jsData[url][0] + 1
            except:
                print "error while processing file"
        # if count > 100:
        #     break

        # if jsData[url][1] != 0:
        #     print url, jsData[url][0]/float(jsData[url][1])
                    # orig_body = getPlainText(http_response_orig)
                    # if "analytics" in http_response_orig.request.first_line.split()[1]:
                    #     print "orig,",file,http_response_orig.request.first_line.split()[1]

                    # for rootm, folderm, filesm in os.walk(args.modified):
                    #     for filem in filesm:
                    #         f_mod = open(os.path.join(rootm, filem))
                    #         http_response_mod.ParseFromString(f_mod.read())

                    #         if isJS(http_response_mod.response.header):
                    #             if "analytics" in http_response_mod.request.first_line.split()[1]:
                    #                 print "mod,",filem,http_response_mod.request.first_line.split()[1]
                    #             mod_body = getPlainText(http_response_mod)
                    #             hash1 = hashlib.md5(orig_body)
                    #             hash2 = hashlib.md5(mod_body)
                    #             if http_response_orig.request.first_line.split()[1] == http_response_mod.request.first_line.split()[1] \
                    #                 and hash1.digest() != hash2.digest():
                    #                 pairs.append((http_response_orig.request.first_line.split()[1],http_response_mod.request.first_line.split()[1]))

    # print json.dumps(pairs)
            
                



if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('original', help='path to input directory')
    parser.add_argument('modified', help='path to input directory')
    # parser.add_argument('url',help='path to output directory')
    args = parser.parse_args()
    main(args)