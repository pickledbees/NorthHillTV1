function auto_scroll(scroll_amt = 2, interval = 40) {
	setInterval(() => {
		window.scrollBy(0,scroll_amt);
	}, interval)
}