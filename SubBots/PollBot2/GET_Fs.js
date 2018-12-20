//only for browswer scripts!

var fsURL = "http://localhost:8000"

//Makes simple GET requests to File Server, returns promise
//also interprets resolution or rejection on fs side using "tags"
function GET_Fs(method,param) { 
	return new Promise((resolve,reject) => {
		var xhr = new XMLHttpRequest();
		let url = fsURL + method;
		let val;
		let err;
		
		if (param) url += param;
		
		xhr.open('GET', url);
		xhr.onload = () => {
			if (xhr.responseText[0] === "S") {
				console.log(method + " was a success");
				val = xhr.responseText.substr(1)
				resolve(val);
			} else if (xhr.responseText[0] === "E"){
				err = xhr.responseText.substr(1)
				reject(err);
			}
		}
		xhr.onerror = () => {
			reject("*File Server Connect Error*");
			console.log(method + " failed");
		}
		xhr.send();
	})
}