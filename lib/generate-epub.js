var arrayBuffer;
var zip = new JSZip();
var fldr_META_INF = zip.folder("META-INF");
var fldr_EPUB = zip.folder("EPUB");
FileReader.prototype.callback = '';
Image.prototype.callback = '';
	
var pageTemplate = Handlebars.compile('<?xml version="1.0" encoding="UTF-8" standalone="no" ?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en"><head><title>{{title}}</title><link rel="stylesheet" type="text/css" href="style.css" /></head><body><section xml:lang="en" class="ebook" title="{{title}}">{{{content}}}</section></body></html>');
var tocTemplate = Handlebars.compile('<?xml version="1.0" encoding="UTF-8" standalone="no" ?><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en"><head><title>{{title}}</title><link rel="stylesheet" type="text/css" href="style.css" /></head><body><h1>{{title}}</h1><nav epub:type="toc" id="toc"><h2>Table of Contents</h2><ol>{{#each items}}<li><a href="{{identifier}}.html">{{title}}</a></li>{{/each}}</ol></nav></body></html>');
var manifestTemplate = Handlebars.compile('<?xml version="1.0"?><package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="{{URL}}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf"><meta name="cover" content="cover-image"/><dc:title>{{title}}</dc:title><dc:language>en</dc:language><dc:identifier id="{{identifier}}">{{identifier}}</dc:identifier><dc:creator opf:file-as="Australian Government, Department of Human Services" opf:role="aut">Department of Human Services</dc:creator></metadata><manifest><item id="htmltoc" properties="nav" media-type="application/xhtml+xml" href="toc.html"/><item  properties="cover-image" id="cover-image" href="cover.jpg" media-type="image/jpeg"/><item media-type="text/css" id="epub-css" href="style.css"/>{{#each items}}<item id="{{identifier}}" href="{{identifier}}.html" media-type="application/xhtml+xml"/>{{/each}}</manifest><spine toc="ncx">{{#each items}}<itemref idref="{{identifier}}" />{{/each}}</spine></package>');

var queue = async.queue( function (item, callback) {
	console.log("Adding: " + item.name);
	if(item.img){
		var img = new Image();
		img.callback = callback;
		if(item.w){ img.width = w; }
		if(item.h){ img.height = h; }
		img.onload = function () {
			var canvas = document.createElement("canvas");
			var ctx = canvas.getContext("2d");
			canvas.width=this.width;
			canvas.height=this.height;
			ctx.drawImage(this, 0, 0);
			dataURI = canvas.toDataURL("image/png")
			this.callback(dataURI.replace(/^data:image\/(png|jpg);base64,/, ""));
		}
		img.src = item.img;
	}else if(item.ajax){
		$.ajax({
			url: item.ajax, 
			processData : false
		}).always(
			function( data ) {
				callback(data);
			}
		);
	} else if(item.blob){
		var fileReader = new FileReader();
		fileReader.callback = callback;
		fileReader.onload = function() {
			this.callback(this.result);
		};
		fileReader.readAsArrayBuffer(item.blob);
	} else {
		callback();
	}
}, 5);


$(document).ready(function(){
	console.time('Generated ePub');
	var ePubMime = "application/epub+zip";
	var ePubMeta = '<?xml version="1.0" encoding="utf-8" standalone="no"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
	var ePubCover = "./lib/cover.jpg";
	var ePubCss = "./lib/main.css";
	
	var items = [];
	$('.epub-page').each(function(index, obj){
		var content = $(obj).html();
		if(index==0){
			content = '<h1>'+$('title').text()+'</h1>' + $(obj).html();
		}
		var item = {
			'title': $(content).find('h1, h2, h3, h4').first().text(),
			'identifier': 'page-'+index,
			'content': content,
		}
		items.push(item);
	});

	var context = {
		'title': $('title').text(),
		'URL': $('link[rel="canonical"]').attr("href") ? $('link[rel="canonical"]').attr("href") : $(window).location,
		'items': items
	}
	
	var ePubMainfest = manifestTemplate(context);
	var ePubToc = tocTemplate(context);
	
	zip.file("mimetype", ePubMime);
	console.log("ePubMime successfully added.");
	
	fldr_EPUB.file("package.opf", ePubMainfest);
	console.log("ePubMainfest successfully added.");
	
	fldr_EPUB.file("toc.html", ePubToc);
	console.log("ePubToc successfully added.");

	fldr_META_INF.file("container.xml", ePubMeta);
	console.log("ePubMeta successfully added.");

	queue.push({ 'name': "ePubCover", 'img': ePubCover } , function(arrayBuffer){
		fldr_EPUB.file("cover.jpg", arrayBuffer, {base64: true, optimizedBinaryString :true});
		console.log("ePubCover successfully added.");
	});

	queue.push({ 'name': "ePubCss", 'ajax': ePubCss } , function(arrayBuffer){
		fldr_EPUB.file("style.css", arrayBuffer);
		console.log("ePubCss successfully added.");
	});

	$.each(context.items, function(index, item){
		console.log("Adding: " + item.identifier+".html");
		fldr_EPUB.file(item.identifier+".html", pageTemplate(item));
		console.log(item.identifier+".html successfully added.");
	});
	
	queue.drain = function() {
		console.timeEnd('Generated ePub');
		var ePubAsBlob = zip.generate({type:"blob"});
		ePubLink = window.URL.createObjectURL(ePubAsBlob);
		$a = $('<p>Successfully Generated ePub: <a href="'+ePubLink+'" download="testPub.epub">Download</a></p>');
		$a.prependTo('body');
	}

});

