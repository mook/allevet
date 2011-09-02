const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

function AlertsService() {
    /**
     * Time to stay open after the item has been fully shown
     */
    this.prefOpenTime = 30000;
}

AlertsService.prototype.showAlertNotification =
function AlertsService_showAlertNotification(imageUrl,
                                             title,
                                             text,
                                             textClickable,
                                             cookie,
                                             alertListener,
                                             name)
{
    var ref = this._createAlert();
    ref.item.setAttribute("cookie", cookie);
    ref.image.setAttribute("src", imageUrl);
    ref.title.setAttribute("value", title);
    ref.text.appendChild(this.document.createTextNode(text));
    if (textClickable) {
        ref.item.addEventListener("click", (function() {
            if (alertListener) {
                try {
                    alertListener.observe(null, "alertclickcallback", cookie);
                } catch (e) {
                    Components.utils.reportError(e);
                }
            }
            this._close(ref.item, alertListener);
        }).bind(this), false);
    }
    var doneOpeningHandler = (function(event) {
        ref.item.removeEventListener(event.type, doneOpeningHandler, false);
        if (ref.item.hasAttribute("close")) {
            // this item is closing already; do nothing
            return;
        }
        // this item has just finished showing; get ready to close
        var timerCallback = (function() {
            timer.cancel();
            timer = null;
            this._close(ref.item, alertListener);
        }).bind(this);
        var timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
        timer.initWithCallback(timerCallback, this.prefOpenTime,
                               Ci.nsITimer.TYPE_ONE_SHOT);
    }).bind(this);
    ref.item.addEventListener("transitionend", doneOpeningHandler, false);
    if (this.panel.state == "closed") {
        this.anchor.openPopupAtScreen(this.document.defaultView.screen.width,
                                      this.document.defaultView.screen.height,
                                      false);
        this.panel.openPopup(this.anchor, "before_end", 0, 0, false, false, null);
    }
    ref.item.style.height = ref.itemBox.style.height =
        "-moz-calc(" + Math.max.apply(null, Array.slice(ref.itemBox.childNodes).map(function(e)e.scrollHeight).concat([ref.itemBox.scrollHeight])) + "px + 1.2em)";
};

AlertsService.prototype._close =
function AlertsService__close(item, listener) {
    if (item.hasAttribute("close")) {
        // this is already closing (or closed).
        return;
    }
    // make sure the slide-open listener will ignore this
    item.setAttribute("close", "true");
    if (listener) {
        try {
            listener.observe(null, "alertfinished", item.getAttribute("cookie"));
        } catch (e) {
            Components.utils.reportError(e);
        }
    }
    var doneClosingHandler = (function (event) {
        item.removeEventListener(event.type, doneClosingHandler, false);
        this.container.removeChild(item);
        if (!this.container.firstChild) {
            this.panel.hidePopup();
            this.anchor.hidePopup();
        }
    }).bind(this);
    item.addEventListener("transitionend", doneClosingHandler, false);
    item.style.height = "0px";
};

/**
 * Create the DOM elements for an item
 * @returns {Object} dict where the keys are the class names
 */
AlertsService.prototype._createAlert = function AlertsService__createAlert() {
    var item = this.document.createElement("box");
    this.container.appendChild(item);
    item.classList.add("item");
    var itemBox = this.document.createElement("hbox");
    item.appendChild(itemBox);
    itemBox.classList.add("itemBox");
    var image = this.document.createElement("image");
    itemBox.appendChild(image);
    image.classList.add("image");
    var textBlock = this.document.createElement("vbox");
    itemBox.appendChild(textBlock);
    textBlock.classList.add("textBlock");
    var title = this.document.createElement("description");
    textBlock.appendChild(title);
    title.classList.add("title");
    title.setAttribute("crop", "end");
    var text = this.document.createElement("description");
    textBlock.appendChild(text);
    text.classList.add("text");
    return {
        item: item,
        itemBox: itemBox,
        image: image,
        textBlock: textBlock,
        title: title,
        text: text
    };
};

XPCOMUtils.defineLazyGetter(AlertsService.prototype, "document", function() {
    var win = Cc["@mozilla.org/appshell/appShellService;1"]
                .getService(Ci.nsIAppShellService)
                .hiddenDOMWindow;
    var frame = win.document.createElement("iframe");
    win.document.documentElement.appendChild(frame);
    var done = false;
    frame.addEventListener("DOMContentLoaded", function() done = true, false);
    frame.setAttribute("src", "chrome://allevet/content/frame.xul");
    while (!done) {
        Services.tm.currentThread.processNextEvent(false);
    }
    return frame.contentDocument;
});

["container", "panel", "anchor"].forEach(function(name) {
    XPCOMUtils.defineLazyGetter(AlertsService.prototype, name, function() {
        return this.document.getElementById(name);
    });
});

/**
 * nsIObserver
 */

AlertsService.prototype.observe =
function AlertsService_observe(subject, topic, data) {
    
};

/**
 * nsISupports
 */
AlertsService.prototype.QueryInterface =
    XPCOMUtils.generateQI([Ci.nsIAlertsService,
                           Ci.nsIObserver]);
AlertsService.prototype.classID =
    Components.ID("{8f390939-5cd0-41cb-adb6-f18a5a5e905e}");
AlertsService.prototype.classDescription = "Alerts Service Replacement";
AlertsService.prototype.contractID = "@mozilla.org/alerts-service;1";

var NSGetFactory = XPCOMUtils.generateNSGetFactory([AlertsService]);
