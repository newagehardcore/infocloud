// Shared state for system-wide controls

let isSuspended = false;

const requestSuspension = () => {
    console.log('[SystemState] Suspension requested. Detailed logging: Blocks RSS fetches and Queue processing.');
    isSuspended = true;
};

const releaseSuspension = () => {
    console.log('[SystemState] Suspension released. Resuming normal operations.');
    isSuspended = false;
};

const isSystemSuspended = () => {
    return isSuspended;
};

module.exports = {
    requestSuspension,
    releaseSuspension,
    isSystemSuspended
};
