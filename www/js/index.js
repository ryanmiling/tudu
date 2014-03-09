var timer = {
    // // // // // // // // // //
    // Initialization
    // // // // // // // // // //

    initialize: function() {
        this.bindEvents();
    },

    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },

    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicity call 'timer.receivedEvent(...);'
    onDeviceReady: function() {
        // Graphics
        timer.draw();
        $(window).resize(timer.draw);

        timer.construct();
    },

    // Timer Constructor
    construct: function() {
        // Immediately lock to portrait
        //setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

        // Set start state
        var $dial = $('.dial');
        $dial.css('opacity',0.0);
        $dial.bind('touchstart', timer.timerActionStart);
        $dial.bind('touchend', timer.timerActionEnd);

        // Set some variables we'll need later
        var dialPosn = $dial.offset();
        timer.circleCenter = [dialPosn.left + timer.RADIUS,
                              dialPosn.top + timer.RADIUS];

        timer.innerCircleRadius = timer.RADIUS / 2;
        timer.innerCircleQuarterCircum = (timer.innerCircleRadius * Math.PI) / 2.0;

        var outerRadiusSq = Math.pow(timer.RADIUS,2),
            innerRadiusSq = Math.pow(timer.innerCircleRadius,2);

        timer.withinRegion = function(x,y) {
            var calc = Math.pow(x-timer.circleCenter[0],2) + Math.pow(y-timer.circleCenter[1],2);
            //console.log('Within region? '+(innerRadiusSq <= calc && calc <= outerRadiusSq));
            return (innerRadiusSq <= calc && calc <= outerRadiusSq)
        };

    },

    // // // // // // // // // //
    // Graphical Setup
    // // // // // // // // // //
    draw: function() {
              var $app = $(".app");
              var sideLength = $app.width();
              var halfSideLength = sideLength/2;
              var quarterSideLength = sideLength/4;
              var eighthSideLength = sideLength/8;

              timer.RADIUS = halfSideLength;

              $app.height(sideLength);
              $app.css('margin-top', -1*halfSideLength);

              var $timer = $app.children(".timer");
              $timer.css('border-radius', halfSideLength);
              var $dial = $app.children(".dial");
              $dial.css('border-radius', halfSideLength);

              var $count = $app.children(".count");
              $count.css({  'font-size': eighthSideLength,
                               'height': eighthSideLength,
                          'margin-left': -1*quarterSideLength,
                           'margin-top': -1*(eighthSideLength+eighthSideLength/2),
                                  'top': quarterSideLength,
                                'width': halfSideLength
                         });

              var $label = $app.children(".label");
              $label.css({'border-radius': quarterSideLength,
                              'font-size': sideLength/10,
                            'line-height': halfSideLength+'px',
                                 'height': halfSideLength,
                                  'width': halfSideLength,
                                    'top': quarterSideLength,
                                   'left': quarterSideLength
              });

              var $reset = $app.children(".reset");
              var resetSideLength = 0.125 * sideLength;
              $reset.css({'border-radius': resetSideLength/2,
                              'font-size': 0.6*resetSideLength,
                                 'height': resetSideLength,
                            'line-height': resetSideLength+'px',
                                  'width': resetSideLength
                         });
          },

    // // // // // // // // // //
    // Variables
    // // // // // // // // // //

    RADIUS: 0,
    CIRCUMMINUTES: 60,

    withinRegion: null, // checks if provided coordinates within input ring

    circleCenter: null,

    startPosn: null,
    startPosnInnerPt: null,
    endPosn: null,

    startPosnDiameterSlope: null, // for a diameter intersecting startPosn
    startPosnTangentSlope: null, // for a line tangent to startPosn

    innerCircleFormula: null,
    innerCircleRadius: null,
    innerCircleQuarterCircum: null,

    cwWindDirection: null, // winding timer in clockwise direction
    lastQuarterTraveled: null,
    quartersTraveled: 0,
    totalTraveled: 0, // minutes


    // // // // // // // // // //
    // Timer & Dial Interaction
    // // // // // // // // // //

    timerActionStart: function(e) {
        var $dial = $(e.target);

        $dial.bind('touchmove', timer.timerTrackMove);
    },
    timerTrackMove: function(e) {
        var $dial = $(e.target);

        timer.labelReset();
        $('.label').addClass('active');

        var changedTouch = e.originalEvent.changedTouches[0];
        if (changedTouch !== undefined) {
            var x = changedTouch.pageX, y = changedTouch.pageY;
            if (!timer.withinRegion(x,y)) {
                timer.timerActionEnd();
            }
            else {
                if (timer.startPosn == null) {
                    timer.startPosn = [x,y];
                }
                else {
                    timer.endPosn = [x,y];
                    totalPercentTraveled = timer.calcDistTraveled();
                    timer.totalTraveled = Math.floor(totalPercentTraveled*timer.CIRCUMMINUTES);

                    $dial.css('opacity', totalPercentTraveled);
                    timer.updateCount(timer.totalTraveled).removeClass('hidden');
                    $('.reset').text('C');
                }
            }
        }
    },
    // Calculate the distance traveled from start to end,
    //   take into consideration going around the circle
    calcDistTraveled: function() {
        // Define startPosn circle
        if (timer.innerCircleFormula == null) {
            // (x-h)^2 + (y-k)^2 = r^2

            // y = k + Math.sqrt(r^2 - (x-h)^2), in terms of x
            timer.innerCircleFormula = function(x) {
                var sqrt = Math.sqrt(Math.pow(timer.innerCircleRadius,2)-Math.pow(x-timer.circleCenter[0],2))
                return [timer.circleCenter[1] + sqrt,
                        timer.circleCenter[1] - sqrt]; // since sqrt-ing is +/-, 2 y-vals exist
            };
        }

        // Get startPosn's inner-circle point, when traveling toward circle center
        if (timer.startPosnInnerPt == null) {
            timer.startPosnInnerPt = timer.calcInnerCirclePt(timer.startPosn[0],timer.startPosn[1]);
        }

        // Get slope where startPosn's inner-circle point is on diameter
        if (timer.startPosnDiameterSlope == null) {
            timer.startPosnDiameterSlope = (timer.startPosnInnerPt[1] - timer.circleCenter[1]) /
                                           (timer.startPosnInnerPt[0] - timer.circleCenter[0]);
        }
        if (timer.startPosnTangentSlope == null) {
            timer.startPosnTangentSlope = -1 * Math.pow(timer.startPosnDiameterSlope,-1);
        }

        var endPosnInnerPt = timer.calcInnerCirclePt(timer.endPosn[0],timer.endPosn[1]);

        var slope = (timer.startPosnInnerPt[1] - endPosnInnerPt[1]) /
                    (timer.startPosnInnerPt[0] - endPosnInnerPt[0]);

        if (isNaN(slope)) {
            return 0; // start inner pt == end inner pt
        }

        var distTraveled = timer.calcPtDistance(timer.startPosnInnerPt[0],
                                                timer.startPosnInnerPt[1],
                                                endPosnInnerPt[0],
                                                endPosnInnerPt[1]);

        /* Circle is divided into 4 quadrants along startPosn's diameter:
         *
         *     Start
         *        \.
         *      IV | I
         *     ----|----
         *     III | II
         */

        var halfNum;
        // Half locators
        if (timer.startPosnDiameterSlope > timer.startPosnTangentSlope) {
            halfNum = (timer.startPosnTangentSlope < slope && slope < timer.startPosnDiameterSlope) ? 1 : 2;

        }
        else {
            halfNum = (slope > timer.startPosnTangentSlope || slope < timer.startPosnDiameterSlope) ? 1 : 2;
        }

        var radiusSq2 = timer.innerCircleRadius * Math.sqrt(2),
            currentQuarter;
        // Quarter locators
        if (halfNum == 1) {
            currentQuarter = distTraveled < radiusSq2 ? 1 : 2;
        }
        else {
            currentQuarter = distTraveled < radiusSq2 ? 4 : 3;
        }

        // we can tell what direction we're moving based on first movement
        if (timer.cwWindDirection == null) {
            timer.cwWindDirection = (currentQuarter == 1);
            //console.log('Wind direction is '+(timer.cwWindDirection?'CW':'CCW'));
        }

        if (timer.lastQuarterTraveled != null && currentQuarter != timer.lastQuarterTraveled) {
            // We can change direction if we pass the start-pt again (i.e. fully unwind)
            var windDirectionChange = false;
            if (timer.quartersTraveled == 0) {
                if (currentQuarter - timer.lastQuarterTraveled == 3) { // IV -> I
                    windDirectionChange = (false != timer.cwWindDirection);
                    timer.cwWindDirection = false;
                }
                else if (currentQuarter - timer.lastQuarterTraveled == -3) { // I -> IV
                    windDirectionChange = (true != timer.cwWindDirection);
                    timer.cwWindDirection = true;
                }
            }

            if (!windDirectionChange) {
                // log quartersTraveled
                var cwMovement;
                if (currentQuarter == 1 && timer.lastQuarterTraveled == 4) {
                    cwMovement = true;
                }
                else if (currentQuarter == 4 && timer.lastQuarterTraveled == 1) {
                    cwMovement = false;
                }
                else if (currentQuarter > timer.lastQuarterTraveled) {
                    cwMovement = true;
                }
                else {
                    cwMovement = false;
                }

                timer.quartersTraveled += (cwMovement == timer.cwWindDirection ? 1 : -1);
            }
            else {
                console.log('Wind direction changed to '+(timer.cwWindDirection?'CW':'CCW'));
            }
        }

        // Distance is 0.25 for each quarter traveled

        // calculate degrees we are from start, on edge of circle
        var theta = (180/Math.PI) * Math.acos(1-(Math.pow(distTraveled,2)/(2*Math.pow(timer.innerCircleRadius,2))));
        var traveled = 0.0;

        // get our partial travels too, varies on direction and quadrant
        if ((timer.cwWindDirection && currentQuarter <= 2) ||
             !timer.cwWindDirection && currentQuarter >= 3) {
            traveled += 0.25 * (theta % 90) / 90.0;
        }
        else {
            traveled += 0.25 * ((180-theta) % 90) / 90.0;
        }
        traveled += timer.quartersTraveled * 0.25; // and include full quarters traveled

        timer.lastQuarterTraveled = currentQuarter;

        return traveled;
    },

    // Given any point x,y return the closest point that would be on the innerCircle
    calcInnerCirclePt: function(x,y) {
        if (x == timer.circleCenter[0]) {
            var yIntersections = timer.innerCircleFormula(x);

            var i = (Math.abs(yIntersections[0] - y) < Math.abs(yIntersections[1] - y)) ? 0 : 1;

            return [x,yIntersections[i]];
        }

        // Define line from x,y to circle center
        var slope = (timer.circleCenter[1] - y) / (timer.circleCenter[0] - x);
        var yIntercept = y - (slope*x);
        var lineY = function(x) { return (slope*x)+yIntercept; };

        // If I provide any x to inner-circle formula, I can get any y

        // Quadratic Formula vars, from solving intersection of line & circle abstractly (in terms of x)
        var a = Math.pow(slope,2) + 1,
            b = 2*yIntercept*slope - 2*timer.circleCenter[1]*slope - 2*timer.circleCenter[0],
            c = Math.pow(timer.circleCenter[0],2) +
                Math.pow(yIntercept,2) +
                Math.pow(timer.circleCenter[1],2) -
                Math.pow(timer.innerCircleRadius,2) -
                2*yIntercept*timer.circleCenter[1];

        var xIntersections = [(-b + Math.sqrt(Math.pow(b,2) - (4*a*c))) / (2*a),
                              (-b - Math.sqrt(Math.pow(b,2) - (4*a*c))) / (2*a)];

        var yIntersections = $.map(xIntersections, lineY); // respectively

        // Whichever intersection is closest to endPosn is what we return
        var distances = [timer.calcPtDistance(x,y,xIntersections[0],yIntersections[0]),
                         timer.calcPtDistance(x,y,xIntersections[1],yIntersections[1])];

        var i = (distances[0] < distances[1]) ? 0 : 1;
        return [xIntersections[i],yIntersections[i]];
    },

    calcPtDistance: function(x1,y1,x2,y2) {
        return Math.sqrt(Math.pow(y2-y1,2) + Math.pow(x2-x1,2));
    },

    timerActionEnd: function(e) {
        var $dial = e === undefined ? $('.dial') : $(e.target);
        $dial.removeClass("down");

        $dial.unbind('touchmove');

        // Let user click button now!
        var $label = $('.label');
        $label.bind('touchstart', function() { $(this).addClass('down'); });
        $label.bind('touchend', timer.startCountdown);

        // reset vals
        timer.startPosn = timer.endPosn = null;
        timer.innerCircleFormula = null;

        timer.startPosn = null;
        timer.startPosnInnerPt = null;
        timer.endPosn = null;

        timer.startPosnDiameterSlope = null; // for a diameter intersecting startPosn
        timer.startPosnTangentSlope = null; // for a line tangent to startPosn

        timer.innerCircleFormula = null;

        timer.lastQuarterTraveled = null;
        timer.cwWindDirection = null;
        timer.quartersTraveled = 0;

        $('.reset').click(timer.fullReset);
    },

    updateCount: function(count) {
        return $('.count').text(count+'m');
    },

    fullReset: function() {
        timer.updateCount(0).addClass('hidden');

        $('.reset').text('');
        $('.dial').removeClass('started');
        $('.label').text('start').removeClass('active started');
        timer.construct();
    },

    labelReset: function() {
        var $label = $('.label');
        $label.unbind('touchstart');
        $label.unbind('touchend');
        $label.removeClass('active');
        $label.text('start');
    },

    startCountdown: function(e) {
        // Cosmetics
        var $label = $(e.target);
        $label.removeClass('down');
        $label.addClass('started');
        $label.text('started');
        $label.unbind(); // REMOVES ALL EVENTS

        $('.dial').addClass('started').unbind(); // REMOVES ALL EVENTS

        // TODO add a kill-switch
        /*
        setTimeout(function() {
            navigator.notification.vibrate(2500);
            navigator.notification.alert(
                "Time's up!",    // message
                timer.fullReset, // callback
                'tudu',          // title
                'K'              // buttonName
            )
        },
        1000*60*timer.totalTraveled
        );
        */

        // TODO remove later on
        /* XXX navigator.notification is working as of 3/2/2014 16:32
        $('body').append('<br/>Testing..');
        $('body').append('<br/> Navigator='+JSON.stringify(navigator));
        $('body').append('<br/> Navigator notification='+JSON.stringify(navigator.notification));

        navigator.notification.alert(
            "Test message",    // message
            timer.fullReset, // callback
            'tudu',          // title
            'K'              // buttonName
        );
        */

        $('body').append('<br/> Device='+JSON.stringify(window.device));
        $('body').append('<br/> Plugin='+JSON.stringify(window.plugin));
        window.plugin.notification.local.add({ message: 'Great app!' });
        //$('body').append('<br/> Plugin Notif='+JSON.stringify(window.plugin.notification));
    }
};

var debug = {
    showPoint: function(x,y,small) {
        var width = small == true ? 10 : 20;
        $('body').append('<div style="height:'+width+'px;width:'+width+'px;position:absolute;top:'+y+'px;left:'+x+'px;background-color:#238e23;"></div>');
    }
};
