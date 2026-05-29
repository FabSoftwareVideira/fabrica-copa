"use strict";

class TradeWindowStateManager {
    constructor() {
        // windowId -> { isOpen: boolean, openedAt: timestamp|null }
        this.openStates = new Map();
    }

    setOpen(windowId, now) {
        this.openStates.set(windowId, { isOpen: true, openedAt: now });
    }

    setClosed(windowId) {
        this.openStates.set(windowId, { isOpen: false, openedAt: null });
    }

    getState(windowId) {
        return this.openStates.get(windowId);
    }

    has(windowId) {
        return this.openStates.has(windowId);
    }

    delete(windowId) {
        this.openStates.delete(windowId);
    }

    keys() {
        return this.openStates.keys();
    }
}

module.exports = { TradeWindowStateManager };
