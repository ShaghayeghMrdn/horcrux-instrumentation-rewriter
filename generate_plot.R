#!/usr/bin/env Rscript


# Create stacked bar charts 

library(ggplot2)
library(ggthemes)
library(extrafont)
library(plyr)
library(scales)
library(reshape2)

args = commandArgs(trailingOnly=TRUE)

data1 = read.csv(args[1], header=TRUE, sep=",")

legend=colnames(data1)[c(-1,-4,-7)]
par(mar=c(15,8,4,2))
par(las=2)
# barplot(t(data1[,c("loading","painting","rendering","scripting")]), col=c("blue","purple","red","yellow"), legend=legend, ylab = "Time (in milliseconds", names.arg = data1$url, las = 2,
#     cex.names = 0.4)

data2 = melt(data1[,c(-4,-7)], id.var="url")

ggplot(data2, aes(x = url, y = value, fill = variable)) + 
  geom_bar(position="fill",stat = "identity") + coord_flip()
  # + theme(text = element_text(size=7)) 
  # + scale_fill_manual("legend", values = c("loading" = "blue", "painting" = "purple", "rendering" = "red", "scripting" = "orange"))

# jpeg('rplot.jpg')