class UploadProgressManager {
    constructor() {
      this.progress = {
        progress: 0,
        speed: 0,
        estimatedRemaining: {
          minutes: 0,
          seconds: 0
        }
      };
    }
  
    updateProgress(data) {
      this.progress = { ...this.progress, ...data };
    }
  
    getProgress() {
      return this.progress;
    }
  }
  
  module.exports = new UploadProgressManager();