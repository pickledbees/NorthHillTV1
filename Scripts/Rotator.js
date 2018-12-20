class Rotator {
	constructor(el) {
		this.r = (function* () {
			el.style.position = "relative";
			var i = 0; //counter for iterating through items in announcement element
			while (true) {
				let items = el.getElementsByTagName("div");
				for (let j = 0; j < items.length; j++) {
					items[j].style.visibility = "hidden";
					items[j].style.position = "absolute";
				}
				i = (i+1)%items.length;
				items[i].style.visibility = "visible";
				yield;
			}
		})();
		this.r.next(); //run once to initialise
		this.intID;
	}
	rotate(time = 10000) {
		let el = this;
		el.intID = setInterval(el.r.next.bind(el.r),time);
	}
	pause() {
		clearInterval(this.intID);
	}
}

