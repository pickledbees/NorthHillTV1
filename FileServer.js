//NODE.js dependancies
var http = require("http"),
	fs = require("fs"),
	U = require("url"),
	Q = require("querystring"),
	fetch = require("node-fetch"),				// fetch-from-url module
	downloadFrom = require("file-download"),	// file-downloader module
	swearjar = require("swearjar");				// swear-filter module

//bot token
var TOKEN = "";

//define file paths (all relative to file server location)
var photos_folder_path 	= "./Tele_photos";			//folder containing telegram photos
var photo_links_file 	= "Tele_photoLinks.json";	//file containing sequence of telegram photo links for display client

var texts_file 			= "Tele_texts.json";		//file containing sequence of telegram texts for display client

var poster_folder_path	= "Posters";
var poster_links_file	= "Poster_photoLinks.json";


http.createServer(onReq).listen(8000, _ => console.log("server has started..."));

//sets up simple get requests
function simpleRes(tag,res,id) {
	return responseText => {
		let hdr = {
			'Content-Type' : 'text/plain',
			'Access-Control-Allow-Origin' : "*"	//wildcard is not recommended if it is a specialised server
		}
		res.writeHead(200, hdr);
		res.write(tag + responseText);
		res.end();
		//console.log("Res Sent -- #" + id + "# -- "+ responseText);
	}
}

//Router
function onReq(req,res) {
	let url = U.parse(req.url);
	let qry = Q.parse(url.query);
	let id = (new Date()).getTime();

	var successRes = simpleRes("S",res,id);		//initialise success response
	var failedRes = simpleRes("E",res,id);		//initialise failure response
	//console.log("Req Rcvd -- #" + id + "# -- " + url.path);


	switch(url.pathname) {
		
		case "/getTelePhoto":
			getTelePhoto(qry,"Tele_photo_",".jpg",photos_folder_path,photo_links_file).then(successRes, failedRes);  //returns photo links
			break;

		case "/getPoster":
			getTelePhoto(qry,"Poster_",".jpg",poster_folder_path,poster_links_file).then(successRes, failedRes);
			break;

		case "/filter_and_save_text":
			filter_and_save_text(qry).then(successRes, failedRes);	//returns filtered text
			break;

		//NOTE: allowing requests to read files and directories is dangerous for a commercial web server!!
		case "/readFile":
			fs.readFile(qry.file, (err,file_str) => successRes(file_str));
			break;

		case "/readDir":
			readDir_getPaths(qry.folder).then(successRes, failedRes);	//returns full file paths relative to server
			break;

		case "/writeFile":
			fs.writeFile(qry.path, qry.content, err => {
				if (err) failedRes("File write failed");
				else successRes(qry.content + "written into" + qry.path);
			})
			break;
		
		default:
			console.log("Someone tried to access this server with invalid method");
			fs.appendFileSync("Intruders.txt", "Someone tried at " + (new Date()) + " with " + url.pathname, "utf8");
	}
}

//from a directory, get array of file paths in a relative to server
function readDir_getPaths(folder_path) {
	return new Promise((resolve,reject) => {
		fs.readdir(folder_path, (err,files) => {
			if (err) {
				reject(err);
			} else {
				resolve(JSON.stringify(files.map(file_name => folder_path + "/" + file_name)));
			}
		})
	})
}

//filter and save text, returns clean text
var texts = JSON.parse(fs.readFileSync(texts_file, "utf8"));
function filter_and_save_text(qry) {
	return new Promise((resolve,reject) => {
		//filter dirty words
		console.log(qry.user + " sent: " + qry.dirty);
		var clean = swearjar.censor(qry.dirty);
		
		//stores message in texts array
		texts.unshift({
			username 	: qry.user,
			text 		: clean
		});
		
		//removes old messages
		while (texts.length > 10) texts.pop();
		
		//saves texts into json
		fs.writeFile(texts_file, JSON.stringify(texts), err => {
			if (err)	{reject("*File Server Text Save Failed*");}
			else 		{resolve(clean);}
		});
	})
}

//coordinate file path fetch, file download and file save, returns a success message to display client
async function getTelePhoto(qry,prefix,ext,folder,linksFile) {
	try {
		let file_download_link 	= await getFileDllink(qry.file_id);
		let local_file_path 	= await getFile(prefix,ext,folder)(file_download_link);
		let photo_links 		= await savePhotoLink(linksFile)(local_file_path, qry.caption);
		return photo_links;
	} catch(e) {
		throw e;
	}
}

//get photo download link
async function getFileDllink(file_id) {
	let url = "https://api.telegram.org/bot" + TOKEN + "/getFile?file_id=" + file_id;
	try 		{return (await (await fetch(url)).json()).result.file_path;}
	catch(e) 	{throw "*File Download Link Fetch Error*";}
}


//download photo and return photo path
function getFile(prefix,ext,folder) {
	return function(file_download_link) {
		var url 	= "https://api.telegram.org/file/bot" + TOKEN + "/" + file_download_link;
		var name 	= prefix + (new Date()).getTime() + ".jpg";
		console.log("Got " + name);
		
		return new Promise((resolve,reject) => {
			let options = {
				directory 	: folder,					//target directory
				filename 	: name,						//desired name
			}
			downloadFrom(url, options, err => {
				if (!err)	{resolve(folder + "/" + name);}
				else 		{reject("*File Download to Server Error*");}
			})
		})
	}
}


//saves photo links into array to be stored in json file and returns the file contents in stringed array form
function savePhotoLink(linksFile) {
	var photo_links_Arr = JSON.parse(fs.readFileSync(linksFile, "utf8"));
	return function(file_link, caption) {
		return new Promise((resolve,reject) => {
			//register photo_link in photo_links_Arr
			photo_links_Arr.unshift({
				photo_link 	: file_link,
				caption 	: caption
			});	
			
			//remove excess photos
			while (photo_links_Arr.length > 5) photo_links_Arr.pop();
			
			//saves array into json file
			fs.writeFile(linksFile, JSON.stringify(photo_links_Arr), err => {
				if (err) 	reject("*File Server Photo Save Failed*");
				else 		resolve("file_src");
			});
		})
	}
}

//function to log errors
function logErr(err) {
	let d = new Date();
	let errMsg = "error occurred at " + d + ": " + err;
	fs.appendFileSync("Error_Log.txt", errMsg, "utf8");
}
