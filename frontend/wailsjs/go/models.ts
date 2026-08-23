export namespace main {
	
	export class RecordingInfo {
	    name: string;
	    path: string;
	
	    static createFrom(source: any = {}) {
	        return new RecordingInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	    }
	}
	export class ScreenshotInfo {
	    name: string;
	    path: string;
	    size: number;
	    createdAt: number;
	    modifiedAt: number;
	    date: number;
	    dateSource: string;
	
	    static createFrom(source: any = {}) {
	        return new ScreenshotInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.date = source["date"];
	        this.dateSource = source["dateSource"];
	    }
	}

}

export namespace screencast {
	
	export class AudioDevice {
	    name: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new AudioDevice(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.description = source["description"];
	    }
	}
	export class SystemAudioInfo {
	    supported: boolean;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemAudioInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.supported = source["supported"];
	        this.message = source["message"];
	    }
	}

}

export namespace settings {
	
	export class Advanced {
	    verboseLogging: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Advanced(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.verboseLogging = source["verboseLogging"];
	    }
	}
	export class Editor {
	    defaultTool: string;
	    defaultFont: string;
	    defaultFontSize: number;
	    defaultColor: string;
	    defaultStrokeWidth: number;
	    defaultOpacity: number;
	
	    static createFrom(source: any = {}) {
	        return new Editor(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.defaultTool = source["defaultTool"];
	        this.defaultFont = source["defaultFont"];
	        this.defaultFontSize = source["defaultFontSize"];
	        this.defaultColor = source["defaultColor"];
	        this.defaultStrokeWidth = source["defaultStrokeWidth"];
	        this.defaultOpacity = source["defaultOpacity"];
	    }
	}
	export class Favorites {
	    recordings: string[];
	    screenshots: string[];
	
	    static createFrom(source: any = {}) {
	        return new Favorites(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.recordings = source["recordings"];
	        this.screenshots = source["screenshots"];
	    }
	}
	export class General {
	    confirmDelete: boolean;
	
	    static createFrom(source: any = {}) {
	        return new General(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.confirmDelete = source["confirmDelete"];
	    }
	}
	export class Recording {
	    saveDir: string;
	    microphone: string;
	    micEnabledByDefault: boolean;
	    systemEnabledByDefault: boolean;
	    showMouseByDefault: boolean;
	    quality: string;
	    notifyOnRecordingEnd: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Recording(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.saveDir = source["saveDir"];
	        this.microphone = source["microphone"];
	        this.micEnabledByDefault = source["micEnabledByDefault"];
	        this.systemEnabledByDefault = source["systemEnabledByDefault"];
	        this.showMouseByDefault = source["showMouseByDefault"];
	        this.quality = source["quality"];
	        this.notifyOnRecordingEnd = source["notifyOnRecordingEnd"];
	    }
	}
	export class Screenshot {
	    saveDir: string;
	    filenamePattern: string;
	    delaySeconds: number;
	    copyToClipboard: boolean;
	    openAfterCapture: boolean;
	    notifyOnCapture: boolean;
	    hidePanelBeforeCapture: boolean;
	    showMouseByDefault: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Screenshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.saveDir = source["saveDir"];
	        this.filenamePattern = source["filenamePattern"];
	        this.delaySeconds = source["delaySeconds"];
	        this.copyToClipboard = source["copyToClipboard"];
	        this.openAfterCapture = source["openAfterCapture"];
	        this.notifyOnCapture = source["notifyOnCapture"];
	        this.hidePanelBeforeCapture = source["hidePanelBeforeCapture"];
	        this.showMouseByDefault = source["showMouseByDefault"];
	    }
	}
	export class Shortcuts {
	    takeScreenshot: string;
	    startRecording: string;
	    stopRecording: string;
	    openPalette: string;
	    openEditor: string;
	    cancel: string;
	
	    static createFrom(source: any = {}) {
	        return new Shortcuts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.takeScreenshot = source["takeScreenshot"];
	        this.startRecording = source["startRecording"];
	        this.stopRecording = source["stopRecording"];
	        this.openPalette = source["openPalette"];
	        this.openEditor = source["openEditor"];
	        this.cancel = source["cancel"];
	    }
	}
	export class Settings {
	    general: General;
	    screenshot: Screenshot;
	    recording: Recording;
	    editor: Editor;
	    advanced: Advanced;
	    shortcuts: Shortcuts;
	    customShortcuts: Record<string, string>;
	    favorites: Favorites;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.general = this.convertValues(source["general"], General);
	        this.screenshot = this.convertValues(source["screenshot"], Screenshot);
	        this.recording = this.convertValues(source["recording"], Recording);
	        this.editor = this.convertValues(source["editor"], Editor);
	        this.advanced = this.convertValues(source["advanced"], Advanced);
	        this.shortcuts = this.convertValues(source["shortcuts"], Shortcuts);
	        this.customShortcuts = source["customShortcuts"];
	        this.favorites = this.convertValues(source["favorites"], Favorites);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

