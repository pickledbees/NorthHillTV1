"use strict";
var TOKEN			= "",
	teleAPI			= "https://api.telegram.org/bot",
	BotAPIurl		= teleAPI + TOKEN,
	default_page	= "Default.html";

var sendMessage = sendMsg(BotAPIurl);	//initialise sendMessage method

//getUpdates();	//starts poll

//Gets Latest Updates
function getUpdates(interval = 0, duration = 0) {
	interval *= 1000;
	duration *= 1000;
	var offset_id = 0;		//tells telegram which update upwards is wanted
	var TID;

	//starts polling: is a self invoking function
	(function startPoll() {
		var url = BotAPIurl + "/getUpdates?offset=" + offset_id;
		var xhr = new XMLHttpRequest();
		
		xhr.open("GET", url);
		xhr.onload = () => {
			let updates = JSON.parse(xhr.responseText).result;
			//console.log(xhr.response);
			try {
				if (updates.length) {										
					sorter(updates);										//send updates to sorter to sort updates
					offset_id = updates[updates.length-1].update_id + 1;	//adjusts offset
				}		
			} catch (e) {}
			TID = setTimeout(startPoll, interval);						//sends another poll based on timeout
		};
		xhr.onerror = () => {
			console.log("Polling failed at: " + new Date());
			TID = setTimeout(startPoll, interval);						//repeat poll anyway
		}
		xhr.send();
		//console.log("Fetching latest updates...");
	})();

	//stops polling if duration is specified
	if (duration) setTimeout(() => {
		let d = new Date();
		clearTimeout(TID);
		console.log("Polling stopped at: " + d);
	}, duration);
}	

//sorts through updates
function sorter(updates) {
	for (let each in updates) {								//updates recieved may be in array form
		let msg = updates[each].message;
		let chl = updates[each].channel_post;

		if (chl) {channelSorter(chl); continue;}

		if (!msg || msg.chat.type !== "private") continue;
		let id 	= msg.chat.id;

		if (msg.text in commands) {							//check for commands
			commands[msg.text](msg, id);
		} else if (id in waitList) {						//if ID is anticipated...
			waitList[id](msg,id);							//call up correct action from "waitlist"
		} else {
			startHandler(msg, id);							//calls startHandler as a default response
		}
	}
}

function channelSorter(channel_post) {
	if (channel_post.photo) {
		autoPosterHandler(channel_post);
		return;
	}
}

//function to run on bot start up
function startHandler(msg,id) {
	delete waitList[id]				//overides any awaited responses
	sendMessage({
		chat_id 	: id,
		parse_mode 	: "Markdown",
		text 		: "Hello " + msg.chat.first_name + "! 😃 \nTo upload messages or photos, use the */post* command!"
	});
}

//handles /post commands
var postHandler = {

	//allows for one time uploads
	req : (msg,id) => {
		console.log("Posting Request from: " + msg.from.username);
		sendMessage({
			chat_id : id,
			text 	: "Send me a text/photo you want displayed!"
		})
		waitList[id] = postHandler.reply;		//await next action
	},

	//tells client to stop anticipating another response from that id
	reply : (msg,id) => {
		delete waitList[id];
		postHandler.replyer(msg,id);
	},

	//sends to repective handlers
	replyer : (msg,id) => {
		if (msg["text"]) {textHandler(msg,id);
		} else if (msg["photo"]) {
			photoHandler(msg,id);
		} else {
			sendMessage({
				chat_id : id,
				text : "❌ That's not a text/photo, try again!"
			})
			if (!waitList[id]) waitList[id] = postHandler.reply;
		}
	},

	//allows for infinite uploads
	uploadON : (msg,id) => {
		console.log("Posting Request from: " + msg.from.username);
		sendMessage({
			chat_id 	: id,
			text 		: "*Upload mode enabled:* You can now begin sending me the text/photo(s) you want displayed! :D",
			parse_mode 	: "Markdown"
		});
		waitList[id] = postHandler.replyer;		//await next action
	},

	uploadOFF : (msg,id) => {
		delete waitList[id]
		sendMessage({
			chat_id 	: id,
			text 		: "*Upload mode disabled*",
			parse_mode 	: "Markdown"
		})
	}
}

function textHandler(msg,id) {
	let user = msg.from.username;
	if (!user) user = "Anonymous";
	let dirty = encodeURIComponent(msg.text).substring(0,140);	//prepares text for sending as querystring parameter

	//send text to file server to filter and save
	GET_Fs("/filter_and_save_text","?dirty=" + dirty + "&user=" + user)	
	.then(clean => {
		sendMessage({
			chat_id : id,
			text 	: "✅ '" + clean + "' uploaded!"
		});		
		setTimeout(renderText);
	}, err => {
		sendMessage({
			chat_id 	: id,
			text 		: err + ": Sorry the upload failed, please try again later...",
			parse_mode 	: "Markdown"
		});
	})
}

function renderText() {
	GET_Fs("/readFile", "?file=Tele_texts.json")
	.then(texts_str => {
		let txtd = document.getElementById("textFeedBox");
		let frg = document.createDocumentFragment();
		txtd.innerHTML = "";
		
		JSON.parse(texts_str).forEach(each => {
			let para = document.createElement("p");
			para.style.marginBottom = "3px";
			let bold = document.createElement("b");
			bold.textContent = `${each.username.toUpperCase()}: `;
			para.appendChild(bold);
			para.appendChild(document.createTextNode(each.text));
			frg.appendChild(para);
		});
		
		txtd.appendChild(frg);

	}, err => {
		console.log(err);
	})

	/*
	OUTPUT:
	<p><b>__USERNAME3__</b>: __message3__</p>    <--latest message
	<p><b>__USERNAME2__</b>: __message2__</p>
	<p><b>__USERNAME1__</b>: __message1__</p>
	*/
}
renderText();


function photoHandler(msg,id) {
	let caption = msg.from.username + ": " + msg.caption;
	
	sendMessage({
		chat_id : id,
		text 	: "Upload in progress, this may take a while..."
	});						
	
	//request file server to download photo, returns file path
	GET_Fs("/getTelePhoto" , "?file_id=" + msg.photo[2].file_id + "&caption=" + caption)	//array index dictates photo size: 0-3
	.then(_ => {					
		sendMessage({
			chat_id 			: id,
			text 				: "✅ Photo uploaded!",
			reply_to_message_id : msg.message_id
		});
		setTimeout(renderPhoto);
	}, err => {					
		console.log(err);
		sendMessage({
			chat_id 	: id,
			text 		: err + ": 🤕\nSorry the upload failed, please try again later.",
			parse_mode 	: "Markdown"
		});
	})
}


function renderPhoto() {
	GET_Fs("/readFile", "?file=Tele_photoLinks.json")
	.then(photo_links_str => {
		let photod = document.querySelector("#imageFeedBox");
		let template = ``;

		if (JSON.parse(photo_links_str).length === 0) return;

		JSON.parse(photo_links_str).forEach(each => {
			template += `<img src="${each.photo_link}" 
				style="height: 100%;
				box-sizing: border-box;
				background-color: black;
				padding-right: 5px;
				">`
		});

		photod.innerHTML = template;
	}, err => {
		console.log(err);
	})
}
renderPhoto();

function autoPosterHandler(channel_post) {
	let i = 3;
	while (!channel_post.photo[i]) i--;
	GET_Fs("/getPoster", "?file_id=" + channel_post.photo[i].file_id)
	.then(_ => setTimeout(updatePosters));
}

function updateAnc() {
	GET_Fs("/readFile", "?file=Announcements.json")	//get announcements object from file server
	.then(anc_str => {
		let template = `<h3><b>Announcements</b></h3> `;
		JSON.parse(anc_str).forEach(el => {
			template += `<div><h5><b>${el.title}</b></h5><p>${el.body}</p></div>`
		});
		document.querySelector("#announcements div").innerHTML = template;
	}, err => {
		console.log(err);
	});
}
updateAnc();

function updatePosters() {
	//get poster paths from file server
	GET_Fs("/readDir", "?folder=./Posters")
	.then(posters_str => {
		let posters_arr = JSON.parse(posters_str);
		let carousel = document.getElementById("poster_carousel");
		carousel.innerHTML = "";
		let frg = document.createDocumentFragment();

		//appends starter poster
		let first_poster_path = posters_arr.shift();
		frg.appendChild(makeCarouselBlock("carousel-item active",first_poster_path));

		//appends rest of the posters
		posters_arr.forEach(poster_path => {
			frg.appendChild(makeCarouselBlock("carousel-item",poster_path));
		});

		carousel.appendChild(frg);

	/*
		OUTPUT:
		
		<div class="carousel-item active">
			<img src="photo_path1"></img>
		</div>

		<div class="carousel-item">
			<img src="photo_path2"></img>
		</div>

		<div class="carousel-item">
			<img src="photo_path3"></img>
		</div>
	*/

	}, err => {
		console.log(err);
	})
}

updatePosters();

//function for updatePosters
function makeCarouselBlock(_className,_src) {
	let div = document.createElement("div");
	div.className = _className;
	div.innerHTML = `<img src="${_src}">`;
	return div;
}

//page cycling object
var i = 0;
var player = {
	t : undefined,
	pages : [{name : default_page, time : 10000}],
	current_page : null,

	open_page : () => {
		if (!RegExp("MAIN").test(player.pages[i]["name"])) {player.current_page = window.open(player.pages[i]["name"])}
	},
	close_page : () => {
		clearTimeout(player.t);
		if (player.current_page) {
			player.current_page.close();
			player.current_page = null;
		}
	},
	flipThrough : () => {
		player.close_page();
		player.open_page();
		player.t = setTimeout(() => {
			i = (i+1)%player.pages.length;
			player.flipThrough();
		}, player.pages[i]["time"]);
	},
	update_pages : () => {
		player.close_page();
		GET_Fs("/readFile", "?file=page_listing.json")
		.then((pages_str) => {
			console.log(pages_str)
			player.pages = JSON.parse(pages_str);
		},(err) => {
			console.log(err);
		})
		.then(player.flipThrough)
	}
}

//sendMessage method, requires initialisation with url
function sendMsg(baseUrl) {
	return (_options, reply_markup) => {
		var qryArr = [];
		let param										//serialise chat params
		for (param in _options) qryArr.push(param + "=" + encodeURIComponent(_options[param]));
		
		var url = baseUrl + "/sendMessage?" + qryArr.join("&");				
		if (reply_markup) url += "&reply_markup=" + JSON.stringify(reply_markup); //serialise reply_markup params
		
		var xhr = new XMLHttpRequest();												//opens request
		xhr.open("POST", url);
		xhr.onload = _ => {console.log("Message sent => " + _options.text)};
		xhr.send();
	}
}

//list of prompt commands
var commands = {
	//public commands
	"/start" 		: startHandler,
	"/cancel"		: startHandler,
	"/post"			: postHandler.req,

	//uncomment to enable commands for stress testing
	"/poston"		: postHandler.uploadON,
	"/postoff"		: postHandler.uploadOFF,
	
	//for personal management of screen	
	"/woahman"		: player.close_page,
	"/keepgoin"		: player.flipThrough,
	"/checkpls"		: player.update_pages,
	"/newnews"		: updateAnc,
	"/newpicnews"	: updatePosters,
}

//list of "next actions"
var waitList = {
	"chatID" : "next_action"		//<---just an example
}