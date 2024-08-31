/**
 * T-Rex runner.
 * @param {string} outerContainerId Outer containing element id.
 * @param {Object} opt_config
 * @constructor
 * @export
 */
function Runner(outerContainerId, opt_config) {
  // Singleton
  if (Runner.instance_) {
    return Runner.instance_;
  }
  Runner.instance_ = this;

  this.outerContainerEl = document.querySelector(outerContainerId);
  this.containerEl = null;
  this.snackbarEl = null;
  // A div to intercept touch events. Only set while (playing && useTouch).
  this.touchController = null;

  this.config = opt_config || Runner.config;
  // Logical dimensions of the container.
  this.dimensions = Runner.defaultDimensions;

  this.canvas = null;
  this.canvasCtx = null;

  this.tRex = null;

  this.distanceMeter = null;
  this.distanceRan = 0;

  this.highestScore = 0;

  this.time = 0;
  this.runningTime = 0;
  this.msPerFrame = 1000 / FPS;
  this.currentSpeed = this.config.SPEED;

  this.obstacles = [];

  this.activated = false; // Whether the easter egg has been activated.
  this.playing = false; // Whether the game is currently in play state.
  this.crashed = false;
  this.paused = false;
  this.inverted = false;
  this.invertTimer = 0;
  this.resizeTimerId_ = null;

  this.playCount = 0;

  // Sound FX.
  this.audioBuffer = null;
  this.soundFx = {};

  // Global web audio context for playing sounds.
  this.audioContext = null;

  // Images.
  this.images = {};
  this.imagesLoaded = 0;

  if (this.isDisabled()) {
    this.setupDisabledRunner();
  } else {
    this.loadImages();
  }
}
window['Runner'] = Runner;


/**
 * Default game width.
 * @const
 */
var DEFAULT_WIDTH = 600;

/**
 * Frames per second.
 * @const
 */
var FPS = 60;

/** @const */
var IS_HIDPI = window.devicePixelRatio > 1;

/** @const */
var IS_IOS = /iPad|iPhone|iPod/.test(window.navigator.platform);

/** @const */
var IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;

/** @const */
var ARCADE_MODE_URL = 'chrome://dino/';

/**
 * Default game configuration.
 * @enum {number}
 */
Runner.config = {
  ACCELERATION: 0.001,
  BG_CLOUD_SPEED: 0.2,
  BOTTOM_PAD: 10,
  // Scroll Y threshold at which the game can be activated.
  CANVAS_IN_VIEW_OFFSET: -10,
  CLEAR_TIME: 3000,
  CLOUD_FREQUENCY: 0.5,
  GAMEOVER_CLEAR_TIME: 750,
  GAP_COEFFICIENT: 0.6,
  GRAVITY: 0.6,
  INITIAL_JUMP_VELOCITY: 12,
  INVERT_FADE_DURATION: 12000,
  INVERT_DISTANCE: 700,
  MAX_BLINK_COUNT: 3,
  MAX_CLOUDS: 6,
  MAX_OBSTACLE_LENGTH: 3,
  MAX_OBSTACLE_DUPLICATION: 2,
  MAX_SPEED: 13,
  MIN_JUMP_HEIGHT: 35,
  MOBILE_SPEED_COEFFICIENT: 1.2,
  RESOURCE_TEMPLATE_ID: 'audio-resources',
  SPEED: 6,
  SPEED_DROP_COEFFICIENT: 3,
  ARCADE_MODE_INITIAL_TOP_POSITION: 35,
  ARCADE_MODE_TOP_POSITION_PERCENT: 0.1
};


/**
 * Default dimensions.
 * @enum {string}
 */
Runner.defaultDimensions = {
  WIDTH: DEFAULT_WIDTH,
  HEIGHT: 150
};


/**
 * CSS class names.
 * @enum {string}
 */
Runner.classes = {
  ARCADE_MODE: 'arcade-mode',
  CANVAS: 'runner-canvas',
  CONTAINER: 'runner-container',
  CRASHED: 'crashed',
  ICON: 'icon-offline',
  INVERTED: 'inverted',
  SNACKBAR: 'snackbar',
  SNACKBAR_SHOW: 'snackbar-show',
  TOUCH_CONTROLLER: 'controller'
};


/**
 * Sprite definition layout of the spritesheet.
 * @enum {Object}
 */
Runner.spriteDefinition = {
  LDPI: {
    CACTUS_LARGE: {x: 332, y: 2},
    CACTUS_SMALL: {x: 228, y: 2},
    CLOUD: {x: 86, y: 2},
    HORIZON: {x: 2, y: 54},
    MOON: {x: 484, y: 2},
    PTERODACTYL: {x: 134, y: 2},
    RESTART: {x: 2, y: 2},
    TEXT_SPRITE: {x: 655, y: 2},
    TREX: {x: 848, y: 2},
    STAR: {x: 645, y: 2}
  },
  HDPI: {
    CACTUS_LARGE: {x: 652, y: 2},
    CACTUS_SMALL: {x: 446, y: 2},
    CLOUD: {x: 166, y: 2},
    HORIZON: {x: 2, y: 104},
    MOON: {x: 954, y: 2},
    PTERODACTYL: {x: 260, y: 2},
    RESTART: {x: 2, y: 2},
    TEXT_SPRITE: {x: 1294, y: 2},
    TREX: {x: 1678, y: 2},
    STAR: {x: 1276, y: 2}
  }
  // HDPI: {
  //   CACTUS_LARGE: {x: 652, y: 2},
  //   CACTUS_SMALL: {x: 446, y: 2},
  //   CLOUD: {x: 166, y: 2},
  //   HORIZON: {x: 2, y: 131},
  //   MOON: {x: 954, y: 2},
  //   PTERODACTYL: {x: 260, y: 2},
  //   RESTART: {x: 2, y: 2},
  //   TEXT_SPRITE: {x: 1294, y: 2},
  //   TREX: {x: 1708, y: 7},
  //   STAR: {x: 1276, y: 2}
  // }
};


/**
 * Sound FX. Reference to the ID of the audio tag on interstitial page.
 * @enum {string}
 */
Runner.sounds = {
  BUTTON_PRESS: 'offline-sound-press',
  HIT: 'offline-sound-hit',
  SCORE: 'offline-sound-reached'
};


/**
 * Key code mapping.
 * @enum {Object}
 */
Runner.keycodes = {
  JUMP: {'38': 1, '32': 1},  // Up, spacebar
  DUCK: {'40': 1},  // Down
  RESTART: {'13': 1}  // Enter
};


/**
 * Runner event names.
 * @enum {string}
 */
Runner.events = {
  ANIM_END: 'webkitAnimationEnd',
  CLICK: 'click',
  KEYDOWN: 'keydown',
  KEYUP: 'keyup',
  POINTERDOWN: 'pointerdown',
  POINTERUP: 'pointerup',
  RESIZE: 'resize',
  TOUCHEND: 'touchend',
  TOUCHSTART: 'touchstart',
  VISIBILITY: 'visibilitychange',
  BLUR: 'blur',
  FOCUS: 'focus',
  LOAD: 'load'
};

Runner.prototype = {
  /**
   * Whether the easter egg has been disabled. CrOS enterprise enrolled devices.
   * @return {boolean}
   */
  isDisabled: function() {
    // return loadTimeData && loadTimeData.valueExists('disabledEasterEgg');
    return false;
  },

  /**
   * For disabled instances, set up a snackbar with the disabled message.
   */
  setupDisabledRunner: function() {
    this.containerEl = document.createElement('div');
    this.containerEl.className = Runner.classes.SNACKBAR;
    this.containerEl.textContent = loadTimeData.getValue('disabledEasterEgg');
    this.outerContainerEl.appendChild(this.containerEl);

    // Show notification when the activation key is pressed.
    document.addEventListener(Runner.events.KEYDOWN, function(e) {
      if (Runner.keycodes.JUMP[e.keyCode]) {
        this.containerEl.classList.add(Runner.classes.SNACKBAR_SHOW);
        document.querySelector('.icon').classList.add('icon-disabled');
      }
    }.bind(this));
  },

  /**
   * Setting individual settings for debugging.
   * @param {string} setting
   * @param {*} value
   */
  updateConfigSetting: function(setting, value) {
    if (setting in this.config && value != undefined) {
      this.config[setting] = value;

      switch (setting) {
        case 'GRAVITY':
        case 'MIN_JUMP_HEIGHT':
        case 'SPEED_DROP_COEFFICIENT':
          this.tRex.config[setting] = value;
          break;
        case 'INITIAL_JUMP_VELOCITY':
          this.tRex.setJumpVelocity(value);
          break;
        case 'SPEED':
          this.setSpeed(value);
          break;
      }
    }
  },

  /**
   * Cache the appropriate image sprite from the page and get the sprite sheet
   * definition.
   */
  loadImages: function() {
    if (IS_HIDPI) {
      Runner.imageSprite = document.getElementById('offline-resources-2x');
      this.spriteDef = Runner.spriteDefinition.HDPI;
    } else {
      Runner.imageSprite = document.getElementById('offline-resources-1x');
      this.spriteDef = Runner.spriteDefinition.LDPI;
    }
    // var logoImg = new Image();      
    // logoImg.src = 'images/default_100_percent/100-offline-sprite.png';
    // Runner.imageSprite.img = logoImg;
    if (Runner.imageSprite.complete) {
      this.init();
    } else {
      // If the images are not yet loaded, add a listener.
      Runner.imageSprite.addEventListener(Runner.events.LOAD,
          this.init.bind(this));
    }
  },

  /**
   * Load and decode base 64 encoded sounds.
   */
  loadSounds: function() {
    if (!IS_IOS) {
      this.audioContext = new AudioContext();

      var resourceTemplate =
          document.getElementById(this.config.RESOURCE_TEMPLATE_ID).content;

      for (var sound in Runner.sounds) {
        var soundSrc =
            resourceTemplate.getElementById(Runner.sounds[sound]).src;
        soundSrc = soundSrc.substr(soundSrc.indexOf(',') + 1);
        var buffer = decodeBase64ToArrayBuffer(soundSrc);

        // Async, so no guarantee of order in array.
        this.audioContext.decodeAudioData(buffer, function(index, audioData) {
            this.soundFx[index] = audioData;
          }.bind(this, sound));
      }
    }
  },

  /**
   * Sets the game speed. Adjust the speed accordingly if on a smaller screen.
   * @param {number} opt_speed
   */
  setSpeed: function(opt_speed) {
    var speed = opt_speed || this.currentSpeed;

    // Reduce the speed on smaller mobile screens.
    if (this.dimensions.WIDTH < DEFAULT_WIDTH) {
      var mobileSpeed = speed * this.dimensions.WIDTH / DEFAULT_WIDTH *
          this.config.MOBILE_SPEED_COEFFICIENT;
      this.currentSpeed = mobileSpeed > speed ? speed : mobileSpeed;
    } else if (opt_speed) {
      this.currentSpeed = opt_speed;
    }
  },

  /**
   * Game initialiser.
   */
  init: function() {
    // Hide the static icon.
    document.querySelector('.' + Runner.classes.ICON).style.visibility =
        'hidden';

    this.adjustDimensions();
    this.setSpeed();

    this.containerEl = document.createElement('div');
    this.containerEl.className = Runner.classes.CONTAINER;

    // Player canvas container.
    this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH,
        this.dimensions.HEIGHT, Runner.classes.PLAYER);

    this.canvasCtx = this.canvas.getContext('2d');
    this.canvasCtx.fillStyle = '#f7f7f7';
    this.canvasCtx.fill();
    Runner.updateCanvasScaling(this.canvas);

    // Horizon contains clouds, obstacles and the ground.
    this.horizon = new Horizon(this.canvas, this.spriteDef, this.dimensions, this.config.GAP_COEFFICIENT);

    // Distance meter
    this.distanceMeter = new DistanceMeter(this.canvas,   this.spriteDef.TEXT_SPRITE, this.dimensions.WIDTH);

    // Draw t-rex
    this.tRex = new Trex(this.canvas, this.spriteDef.TREX);

    this.outerContainerEl.appendChild(this.containerEl);

    this.startListening();
    this.update();

    window.addEventListener(Runner.events.RESIZE,
        this.debounceResize.bind(this));
  },

  /**
   * Create the touch controller. A div that covers whole screen.
   */
  createTouchController: function() {
    this.touchController = document.createElement('div');
    this.touchController.className = Runner.classes.TOUCH_CONTROLLER;
    this.touchController.addEventListener(Runner.events.TOUCHSTART, this);
    this.touchController.addEventListener(Runner.events.TOUCHEND, this);
    this.outerContainerEl.appendChild(this.touchController);
  },

  /**
   * Debounce the resize event.
   */
  debounceResize: function() {
    if (!this.resizeTimerId_) {
      this.resizeTimerId_ =
          setInterval(this.adjustDimensions.bind(this), 250);
    }
  },

  /**
   * Adjust game space dimensions on resize.
   */
  adjustDimensions: function() {
    clearInterval(this.resizeTimerId_);
    this.resizeTimerId_ = null;

    var boxStyles = window.getComputedStyle(this.outerContainerEl);
    var padding = Number(boxStyles.paddingLeft.substr(0,
        boxStyles.paddingLeft.length - 2));

    this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2;
    if (this.isArcadeMode()) {
      this.dimensions.WIDTH = Math.min(DEFAULT_WIDTH, this.dimensions.WIDTH);
      if (this.activated) {
        this.setArcadeModeContainerScale();
      }
    }

    // Redraw the elements back onto the canvas.
    if (this.canvas) {
      this.canvas.width = this.dimensions.WIDTH;
      this.canvas.height = this.dimensions.HEIGHT;

      Runner.updateCanvasScaling(this.canvas);

      this.distanceMeter.calcXPos(this.dimensions.WIDTH);
      this.clearCanvas();
      this.horizon.update(0, 0, true);
      this.tRex.update(0);

      // Outer container and distance meter.
      if (this.playing || this.crashed || this.paused) {
        this.containerEl.style.width = this.dimensions.WIDTH + 'px';
        this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
        this.distanceMeter.update(0, Math.ceil(this.distanceRan));
        this.stop();
      } else {
        this.tRex.draw(0, 0);
      }

      // Game over panel.
      if (this.crashed && this.gameOverPanel) {
        this.gameOverPanel.updateDimensions(this.dimensions.WIDTH);
        this.gameOverPanel.draw();
      }
    }
  },

  /**
   * Play the game intro.
   * Canvas container width expands out to the full width.
   */
  playIntro: function() {
    if (!this.activated && !this.crashed) {
      this.playingIntro = true;
      this.tRex.playingIntro = true;

      this.containerEl.addEventListener(Runner.events.ANIM_END,
          this.startGame.bind(this));

      this.containerEl.style.webkitAnimation = 'intro .4s ease-out 1 both';
      this.containerEl.style.width = this.dimensions.WIDTH + 'px';

      this.setPlayStatus(true);
      this.activated = true;
    } else if (this.crashed) {
      this.restart();
    }
  },


  /**
   * Update the game status to started.
   */
  startGame: function() {
    if (this.isArcadeMode()) {
      this.setArcadeMode();
    }
    this.runningTime = 0;
    this.playingIntro = false;
    this.tRex.playingIntro = false;
    this.containerEl.style.webkitAnimation = '';
    this.playCount++;

    // Handle tabbing off the page. Pause the current game.
    document.addEventListener(Runner.events.VISIBILITY,
          this.onVisibilityChange.bind(this));

    window.addEventListener(Runner.events.BLUR,
          this.onVisibilityChange.bind(this));

    window.addEventListener(Runner.events.FOCUS,
          this.onVisibilityChange.bind(this));
  },

  clearCanvas: function() {
    this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH,
        this.dimensions.HEIGHT);
  },

  /**
   * Checks whether the canvas area is in the viewport of the browser
   * through the current scroll position.
   * @return boolean.
   */
  isCanvasInView: function() {
    return this.containerEl.getBoundingClientRect().top >
        Runner.config.CANVAS_IN_VIEW_OFFSET;
  },

  /**
   * Update the game frame and schedules the next one.
   */
  update: function() {
    this.updatePending = false;

    var now = getTimeStamp();
    var deltaTime = now - (this.time || now);

    this.time = now;

    if (this.playing) {
      this.clearCanvas();

      if (this.tRex.jumping) {
        this.tRex.updateJump(deltaTime);
      }

      this.runningTime += deltaTime;
      var hasObstacles = this.runningTime > this.config.CLEAR_TIME;

      // First jump triggers the intro.
      if (this.tRex.jumpCount == 1 && !this.playingIntro) {
        this.playIntro();
      }

      // The horizon doesn't move until the intro is over.
      if (this.playingIntro) {
        this.horizon.update(0, this.currentSpeed, hasObstacles);
      } else {
        deltaTime = !this.activated ? 0 : deltaTime;
        this.horizon.update(deltaTime, this.currentSpeed, hasObstacles,
            this.inverted);
      }

      // Check for collisions.
      var collision = hasObstacles &&
          checkForCollision(this.horizon.obstacles[0], this.tRex);

      if (!collision) {
        this.distanceRan += this.currentSpeed * deltaTime / this.msPerFrame;

        if (this.currentSpeed < this.config.MAX_SPEED) {
          this.currentSpeed += this.config.ACCELERATION;
        }
      } else {
        this.gameOver();
      }

      var playAchievementSound = this.distanceMeter.update(deltaTime,
          Math.ceil(this.distanceRan));

      if (playAchievementSound) {
        this.playSound(this.soundFx.SCORE);
      }

      // Night mode.
      if (this.invertTimer > this.config.INVERT_FADE_DURATION) {
        this.invertTimer = 0;
        this.invertTrigger = false;
        this.invert();
      } else if (this.invertTimer) {
        this.invertTimer += deltaTime;
      } else {
        var actualDistance =
            this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan));

        if (actualDistance > 0) {
          this.invertTrigger = !(actualDistance %
              this.config.INVERT_DISTANCE);

          if (this.invertTrigger && this.invertTimer === 0) {
            this.invertTimer += deltaTime;
            this.invert();
          }
        }
      }
    }

    if (this.playing || (!this.activated &&
        this.tRex.blinkCount < Runner.config.MAX_BLINK_COUNT)) {
      this.tRex.update(deltaTime);
      this.scheduleNextUpdate();
    }
  },

  /**
   * Event handler.
   */
  handleEvent: function(e) {
    return (function(evtType, events) {
      switch (evtType) {
        case events.KEYDOWN:
        case events.TOUCHSTART:
        case events.POINTERDOWN:
          this.onKeyDown(e);
          break;
        case events.KEYUP:
        case events.TOUCHEND:
        case events.POINTERUP:
          this.onKeyUp(e);
          break;
      }
    }.bind(this))(e.type, Runner.events);
  },

  /**
   * Bind relevant key / mouse / touch listeners.
   */
  startListening: function() {
    // Keys.
    document.addEventListener(Runner.events.KEYDOWN, this);
    document.addEventListener(Runner.events.KEYUP, this);

    // Touch / pointer.
    this.containerEl.addEventListener(Runner.events.TOUCHSTART, this);
    document.addEventListener(Runner.events.POINTERDOWN, this);
    document.addEventListener(Runner.events.POINTERUP, this);
  },

  /**
   * Remove all listeners.
   */
  stopListening: function() {
    document.removeEventListener(Runner.events.KEYDOWN, this);
    document.removeEventListener(Runner.events.KEYUP, this);

    if (this.touchController) {
      this.touchController.removeEventListener(Runner.events.TOUCHSTART, this);
      this.touchController.removeEventListener(Runner.events.TOUCHEND, this);
    }

    this.containerEl.removeEventListener(Runner.events.TOUCHSTART, this);
    document.removeEventListener(Runner.events.POINTERDOWN, this);
    document.removeEventListener(Runner.events.POINTERUP, this);
  },

  /**
   * Process keydown.
   * @param {Event} e
   */
  onKeyDown: function(e) {
    // Prevent native page scrolling whilst tapping on mobile.
    if (IS_MOBILE && this.playing) {
      e.preventDefault();
    }

    if (this.isCanvasInView()) {
      if (!this.crashed && !this.paused) {
        if (Runner.keycodes.JUMP[e.keyCode] ||
            e.type == Runner.events.TOUCHSTART) {
          e.preventDefault();
          // Starting the game for the first time.
          if (!this.playing) {
            // Started by touch so create a touch controller.
            if (!this.touchController && e.type == Runner.events.TOUCHSTART) {
              this.createTouchController();
            }
            this.loadSounds();
            this.setPlayStatus(true);
            this.update();
            if (window.errorPageController) {
              errorPageController.trackEasterEgg();
            }
          }
          // Start jump.
          if (!this.tRex.jumping && !this.tRex.ducking) {
            this.playSound(this.soundFx.BUTTON_PRESS);
            this.tRex.startJump(this.currentSpeed);
          }
        } else if (this.playing && Runner.keycodes.DUCK[e.keyCode]) {
          e.preventDefault();
          if (this.tRex.jumping) {
            // Speed drop, activated only when jump key is not pressed.
            this.tRex.setSpeedDrop();
          } else if (!this.tRex.jumping && !this.tRex.ducking) {
            // Duck.
            this.tRex.setDuck(true);
          }
        }
      } else if (this.crashed && e.type == Runner.events.TOUCHSTART &&
          e.currentTarget == this.containerEl) {
        this.restart();
      }
    }
  },


  /**
   * Process key up.
   * @param {Event} e
   */
  onKeyUp: function(e) {
    var keyCode = String(e.keyCode);
    var isjumpKey = Runner.keycodes.JUMP[keyCode] ||
       e.type == Runner.events.TOUCHEND ||
       e.type == Runner.events.POINTERUP;

    if (this.isRunning() && isjumpKey) {
      this.tRex.endJump();
    } else if (Runner.keycodes.DUCK[keyCode]) {
      this.tRex.speedDrop = false;
      this.tRex.setDuck(false);
    } else if (this.crashed) {
      // Check that enough time has elapsed before allowing jump key to restart.
      var deltaTime = getTimeStamp() - this.time;

      if (this.isCanvasInView() &&
          (Runner.keycodes.RESTART[keyCode] || this.isLeftClickOnCanvas(e) ||
          (deltaTime >= this.config.GAMEOVER_CLEAR_TIME &&
          Runner.keycodes.JUMP[keyCode]))) {
        this.restart();
      }
    } else if (this.paused && isjumpKey) {
      // Reset the jump state
      this.tRex.reset();
      this.play();
    }
  },

  /**
   * Returns whether the event was a left click on canvas.
   * On Windows right click is registered as a click.
   * @param {Event} e
   * @return {boolean}
   */
  isLeftClickOnCanvas: function(e) {
    return e.button != null && e.button < 2 &&
        e.type == Runner.events.POINTERUP && e.target == this.canvas;
  },

  /**
   * RequestAnimationFrame wrapper.
   */
  scheduleNextUpdate: function() {
    if (!this.updatePending) {
      this.updatePending = true;
      this.raqId = requestAnimationFrame(this.update.bind(this));
    }
  },

  /**
   * Whether the game is running.
   * @return {boolean}
   */
  isRunning: function() {
    return !!this.raqId;
  },

  /**
   * Game over state.
   */
  gameOver: function() {
    this.playSound(this.soundFx.HIT);
    vibrate(200);

    this.stop();
    this.crashed = true;
    this.distanceMeter.achievement = false;

    this.tRex.update(100, Trex.status.CRASHED);

    // Game over panel.
    if (!this.gameOverPanel) {
      this.gameOverPanel = new GameOverPanel(this.canvas,
          this.spriteDef.TEXT_SPRITE, this.spriteDef.RESTART,
          this.dimensions);
    } else {
      this.gameOverPanel.draw();
    }

    // Update the high score.
    if (this.distanceRan > this.highestScore) {
      this.highestScore = Math.ceil(this.distanceRan);
      this.distanceMeter.setHighScore(this.highestScore);
    }

    // Reset the time clock.
    this.time = getTimeStamp();
  },

  stop: function() {
    this.setPlayStatus(false);
    this.paused = true;
    cancelAnimationFrame(this.raqId);
    this.raqId = 0;
  },

  play: function() {
    if (!this.crashed) {
      this.setPlayStatus(true);
      this.paused = false;
      this.tRex.update(0, Trex.status.RUNNING);
      this.time = getTimeStamp();
      this.update();
    }
  },

  restart: function() {
    if (!this.raqId) {
      this.playCount++;
      this.runningTime = 0;
      this.setPlayStatus(true);
      this.paused = false;
      this.crashed = false;
      this.distanceRan = 0;
      this.setSpeed(this.config.SPEED);
      this.time = getTimeStamp();
      this.containerEl.classList.remove(Runner.classes.CRASHED);
      this.clearCanvas();
      this.distanceMeter.reset(this.highestScore);
      this.horizon.reset();
      this.tRex.reset();
      this.playSound(this.soundFx.BUTTON_PRESS);
      this.invert(true);
      this.bdayFlashTimer = null;
      this.update();
    }
  },

  setPlayStatus: function(isPlaying) {
    if (this.touchController)
      this.touchController.classList.toggle(HIDDEN_CLASS, !isPlaying);
    this.playing = isPlaying;
  },

  /**
   * Whether the game should go into arcade mode.
   * @return {boolean}
   */
  isArcadeMode: function() {
    return document.title == ARCADE_MODE_URL;
  },

  /**
   * Hides offline messaging for a fullscreen game only experience.
   */
  setArcadeMode: function() {
    document.body.classList.add(Runner.classes.ARCADE_MODE);
    this.setArcadeModeContainerScale();
  },

  /**
   * Sets the scaling for arcade mode.
   */
  setArcadeModeContainerScale: function() {
    var windowHeight = window.innerHeight;
    var scaleHeight = windowHeight / this.dimensions.HEIGHT;
    var scaleWidth = window.innerWidth / this.dimensions.WIDTH;
    var scale = Math.max(1, Math.min(scaleHeight, scaleWidth));
    var scaledCanvasHeight = this.dimensions.HEIGHT * scale;
    // Positions the game container at 10% of the available vertical window
    // height minus the game container height.
    var translateY = Math.ceil(Math.max(0, (windowHeight - scaledCanvasHeight -
        Runner.config.ARCADE_MODE_INITIAL_TOP_POSITION) *
        Runner.config.ARCADE_MODE_TOP_POSITION_PERCENT)) *
        window.devicePixelRatio;
    this.containerEl.style.transform = 'scale(' + scale + ') translateY(' +
        translateY + 'px)';
  },

  /**
   * Pause the game if the tab is not in focus.
   */
  onVisibilityChange: function(e) {
    if (document.hidden || document.webkitHidden || e.type == 'blur' ||
      document.visibilityState != 'visible') {
      this.stop();
    } else if (!this.crashed) {
      this.tRex.reset();
      this.play();
    }
  },

  /**
   * Play a sound.
   * @param {SoundBuffer} soundBuffer
   */
  playSound: function(soundBuffer) {
    if (soundBuffer) {
      var sourceNode = this.audioContext.createBufferSource();
      sourceNode.buffer = soundBuffer;
      sourceNode.connect(this.audioContext.destination);
      sourceNode.start(0);
    }
  },

  /**
   * Inverts the current page / canvas colors.
   * @param {boolean} Whether to reset colors.
   */
  invert: function(reset) {
    if (reset) {
      document.body.classList.toggle(Runner.classes.INVERTED, false);
      this.invertTimer = 0;
      this.inverted = false;
    } else {
      this.inverted = document.body.classList.toggle(Runner.classes.INVERTED,
          this.invertTrigger);
    }
  }
};


/**
 * Updates the canvas size taking into
 * account the backing store pixel ratio and
 * the device pixel ratio.
 *
 * See article by Paul Lewis:
 * http://www.html5rocks.com/en/tutorials/canvas/hidpi/
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} opt_width
 * @param {number} opt_height
 * @return {boolean} Whether the canvas was scaled.
 */
Runner.updateCanvasScaling = function(canvas, opt_width, opt_height) {
  var context = canvas.getContext('2d');

  // Query the various pixel ratios
  var devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
  var backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1;
  var ratio = devicePixelRatio / backingStoreRatio;

  // Upscale the canvas if the two ratios don't match
  if (devicePixelRatio !== backingStoreRatio) {
    var oldWidth = opt_width || canvas.width;
    var oldHeight = opt_height || canvas.height;

    canvas.width = oldWidth * ratio;
    canvas.height = oldHeight * ratio;

    canvas.style.width = oldWidth + 'px';
    canvas.style.height = oldHeight + 'px';

    // Scale the context to counter the fact that we've manually scaled
    // our canvas element.
    context.scale(ratio, ratio);
    return true;
  } else if (devicePixelRatio == 1) {
    // Reset the canvas width / height. Fixes scaling bug when the page is
    // zoomed and the devicePixelRatio changes accordingly.
    canvas.style.width = canvas.width + 'px';
    canvas.style.height = canvas.height + 'px';
  }
  return false;
};


/**
 * Get random number.
 * @param {number} min
 * @param {number} max
 * @param {number}
 */
function getRandomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


/**
 * Vibrate on mobile devices.
 * @param {number} duration Duration of the vibration in milliseconds.
 */
function vibrate(duration) {
  if (IS_MOBILE && window.navigator.vibrate) {
    window.navigator.vibrate(duration);
  }
}


/**
 * Create canvas element.
 * @param {HTMLElement} container Element to append canvas to.
 * @param {number} width
 * @param {number} height
 * @param {string} opt_classname
 * @return {HTMLCanvasElement}
 */
function createCanvas(container, width, height, opt_classname) {
  var canvas = document.createElement('canvas');
  canvas.className = opt_classname ? Runner.classes.CANVAS + ' ' +
      opt_classname : Runner.classes.CANVAS;
  canvas.width = width;
  canvas.height = height;
  container.appendChild(canvas);

  return canvas;
}


/**
 * Decodes the base 64 audio to ArrayBuffer used by Web Audio.
 * @param {string} base64String
 */
function decodeBase64ToArrayBuffer(base64String) {
  var len = (base64String.length / 4) * 3;
  var str = atob(base64String);
  var arrayBuffer = new ArrayBuffer(len);
  var bytes = new Uint8Array(arrayBuffer);

  for (var i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes.buffer;
}


/**
 * Return the current timestamp.
 * @return {number}
 */
function getTimeStamp() {
  return IS_IOS ? new Date().getTime() : performance.now();
}


//******************************************************************************


/**
 * Game over panel.
 * @param {!HTMLCanvasElement} canvas
 * @param {Object} textImgPos
 * @param {Object} restartImgPos
 * @param {!Object} dimensions Canvas dimensions.
 * @constructor
 */
function GameOverPanel(canvas, textImgPos, restartImgPos, dimensions) {
  this.canvas = canvas;
  this.canvasCtx = canvas.getContext('2d');
  this.canvasDimensions = dimensions;
  this.textImgPos = textImgPos;
  this.restartImgPos = restartImgPos;
  this.draw();
};


/**
 * Dimensions used in the panel.
 * @enum {number}
 */
GameOverPanel.dimensions = {
  TEXT_X: 0,
  TEXT_Y: 13,
  TEXT_WIDTH: 191,
  TEXT_HEIGHT: 11,
  RESTART_WIDTH: 36,
  RESTART_HEIGHT: 32
};


GameOverPanel.prototype = {
  /**
   * Update the panel dimensions.
   * @param {number} width New canvas width.
   * @param {number} opt_height Optional new canvas height.
   */
  updateDimensions: function(width, opt_height) {
    this.canvasDimensions.WIDTH = width;
    if (opt_height) {
      this.canvasDimensions.HEIGHT = opt_height;
    }
  },

  /**
   * Draw the panel.
   */
  draw: function() {
    var dimensions = GameOverPanel.dimensions;

    var centerX = this.canvasDimensions.WIDTH / 2;

    // Game over text.
    var textSourceX = dimensions.TEXT_X;
    var textSourceY = dimensions.TEXT_Y;
    var textSourceWidth = dimensions.TEXT_WIDTH;
    var textSourceHeight = dimensions.TEXT_HEIGHT;

    var textTargetX = Math.round(centerX - (dimensions.TEXT_WIDTH / 2));
    var textTargetY = Math.round((this.canvasDimensions.HEIGHT - 25) / 3);
    var textTargetWidth = dimensions.TEXT_WIDTH;
    var textTargetHeight = dimensions.TEXT_HEIGHT;

    var restartSourceWidth = dimensions.RESTART_WIDTH;
    var restartSourceHeight = dimensions.RESTART_HEIGHT;
    var restartTargetX = centerX - (dimensions.RESTART_WIDTH / 2);
    var restartTargetY = this.canvasDimensions.HEIGHT / 2;

    if (IS_HIDPI) {
      textSourceY *= 2;
      textSourceX *= 2;
      textSourceWidth *= 2;
      textSourceHeight *= 2;
      restartSourceWidth *= 2;
      restartSourceHeight *= 2;
    }

    textSourceX += this.textImgPos.x;
    textSourceY += this.textImgPos.y;

    // Game over text from sprite.
    this.canvasCtx.drawImage(Runner.imageSprite,
        textSourceX, textSourceY, textSourceWidth, textSourceHeight,
        textTargetX, textTargetY, textTargetWidth, textTargetHeight);

    // Restart button.
    this.canvasCtx.drawImage(Runner.imageSprite,
        this.restartImgPos.x, this.restartImgPos.y,
        restartSourceWidth, restartSourceHeight,
        restartTargetX, restartTargetY, dimensions.RESTART_WIDTH,
        dimensions.RESTART_HEIGHT);
  }
};