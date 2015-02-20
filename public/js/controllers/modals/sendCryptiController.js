require('angular');

angular.module('webApp').controller('sendCryptiController', ["$scope", "sendCryptiModal", "$http", "userService", "$timeout", "peerFactory", function ($scope, sendCryptiModal, $http, userService, $timeout, peerFactory) {
    $scope.sending = false;
    $scope.accountValid = true;
    $scope.fromServer = "";
    $scope.maxlength = 8;
    $scope.onlyNumbers = /^-?\d*(\.\d+)?$/;
    $scope.secondPassphrase = userService.secondPassphrase;


    Number.prototype.roundTo = function (digitsCount) {
        var digitsCount = typeof digitsCount !== 'undefined' ? digitsCount : 2;
        var s = String(this);
        if (s.indexOf('e') < 0) {
            var e = s.indexOf('.');
            if (e == -1) return this;
            var c = s.length - e - 1;
            if (c < digitsCount) digitsCount = c;
            var e1 = e + 1 + digitsCount;
            var d = Number(s.substr(0, e) + s.substr(e + 1, digitsCount));
            if (s[e1] > 4) d += 1;
            d /= Math.pow(10, digitsCount);
            return d.valueOf();
        } else {
            return this.toFixed(digitsCount);
        }
    }

    Math.roundTo = function (number, digitsCount) {
        number = Number(number);
        return number.roundTo(digitsCount).valueOf();
    }

    $scope.close = function () {
        if ($scope.destroy) {
            $scope.destroy();
        }

        sendCryptiModal.deactivate();
    }

    $scope.moreThanEightDigits = function (number) {
        if (number.indexOf(".") < 0) {
            return false;
        }
        else {
            if (number.split('.')[1].length > 8) {
                return true;
            }
            else {
                return false;
            }
        }
    }

    $scope.recalculateFee = function ($event) {
        if (!$scope.amount || isNaN(parseFloat($scope.amount))) {
            $scope.fee = "";
        } else {
            if ($scope.amount.indexOf('.') >= 0) {
                var strs = $scope.amount.split('.');
                $scope.maxlength = strs[0].length + 9;
            }
            // calculate fee.
            var fee = parseInt($scope.amount * 100000000 / 100 * $scope.currentFee) / 100000000; //($scope.amount / 100 * $scope.currentFee).roundTo(8);

            if ($scope.amount == 0) {
                fee = 0;
            } else if (parseFloat(fee) == 0) {
                fee = "0.00000001";
                $scope.fee = fee;
            } else {
                $scope.fee = fee.toFixed(8);
            }
        }

        /*
         if (!$scope.amount) {
         $scope.fee = "";
         return;
         }

         if($scope.moreThanEightDigits(parseFloat($scope.amount))){
         console.log('fee');
         $scope.amount = parseFloat($scope.amount).roundTo(8).toString();
         console.log($scope.amount);
         }
         if($scope.currentFee){
         var fee = $scope.amount * $scope.currentFee * 0.01;
         }


         $scope.fee = fee.roundTo(8);
         */
    }


    $scope.accountChanged = function (e) {
        var string = $scope.to;

        if (!string) {
            return;
        }

        if (string[string.length - 1] == "D" || string[string.length - 1] == "C") {
            var isnum = /^\d+$/.test(string.substring(0, string.length - 1));
            if (isnum && string.length - 1 >= 1 && string.length - 1 <= 20) {
                $scope.accountValid = true;
            }
            else {
                $scope.accountValid = false;
            }
        }
        else {
            $scope.accountValid = false;
        }
    }

    $scope.moreThanEightDigits = function (number) {
        if (number.toString().indexOf(".") < 0) {
            return false;
        }
        else {
            if (number.toString().split('.')[1].length > 8) {
                return true;
            }
            else {
                return false;
            }
        }
    }

    $scope.getCurrentFee = function () {
        $http.get(peerFactory.url + "/api/blocks/getFee")
            .then(function (resp) {
                $scope.currentFee = resp.data.fee;
            });
    }

    $scope.convertXCR = function (currency) {
        currency = String(currency);

        var parts = currency.split(".");

        var amount = parts[0];

        //no fractional part
        if (parts.length == 1) {
            var fraction = "00000000";
        } else if (parts.length == 2) {
            if (parts[1].length <= 8) {
                var fraction = parts[1];
            } else {
                var fraction = parts[1].substring(0, 8);
            }
        } else {
            throw "Invalid input";
        }

        for (var i = fraction.length; i < 8; i++) {
            fraction += "0";
        }

        var result = amount + "" + fraction;

        //in case there's a comma or something else in there.. at this point there should only be numbers
        if (!/^\d+$/.test(result)) {
            throw "Invalid input.";
        }

        //remove leading zeroes
        result = result.replace(/^0+/, "");

        if (result === "") {
            result = "0";
        }

        return parseInt(result);
    }

    $scope.sendCrypti = function () {

        $scope.amountError = $scope.convertXCR($scope.fee) + $scope.convertXCR($scope.amount) > userService._unconfirmedBalance;

        var data = {
            secret: $scope.secretPhrase,
            amount: $scope.convertXCR($scope.amount),
            recipientId: $scope.to,
            publicKey: userService.publicKey
        };

        if ($scope.secondPassphrase) {
            data.secondSecret = $scope.secondPhrase;
        }

        if (!$scope.amountError && !$scope.sending) {
            $scope.sending = !$scope.sending;
            $http.put(peerFactory.url + "/api/transactions", data).then(function (resp) {
                $scope.sending = !$scope.sending;
                if (resp.data.error) {
                    $scope.fromServer = resp.data.error;
                }
                else {
                    if ($scope.destroy) {
                        $scope.destroy();
                    }
                    sendCryptiModal.deactivate();
                }
            });

        }
    }
    $scope.getCurrentFee();
}]);