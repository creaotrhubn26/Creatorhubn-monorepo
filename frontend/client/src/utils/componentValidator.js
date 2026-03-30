"use strict";
/**
 * Component Validation and Runtime Type Checking
 * Comprehensive prop validation and runtime type checking for React components.
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValidationStatistics = exports.createValidationHook = exports.createValidationHOC = exports.registerValidationRules = exports.validateProps = exports.componentValidator = void 0;
var react_1 = require("react");
var COMMON_RULE_SET = 'common';
var ComponentValidator = /** @class */ (function () {
    function ComponentValidator(config) {
        if (config === void 0) { config = {}; }
        this.validationRules = new Map();
        this.deprecatedProps = new Map();
        this.performanceWarnings = new Map();
        this.validationCache = new Map();
        this.config = __assign({ enableRuntimeValidation: true, enablePropValidation: true, enableTypeChecking: true, enableDeprecationWarnings: true, enablePerformanceWarnings: true, strictMode: false, logLevel: 'warn' }, config);
        this.initializeValidator();
    }
    ComponentValidator.prototype.initializeValidator = function () {
        this.setupDefaultValidationRules();
        this.setupDeprecationWarnings();
        this.setupPerformanceWarnings();
    };
    ComponentValidator.prototype.setupDefaultValidationRules = function () {
        var commonRules = {
            className: {
                type: 'string',
                pattern: /^[a-zA-Z0-9\s\-_]+$/,
                message: 'className must be a valid CSS class name',
            },
            id: {
                type: 'string',
                pattern: /^[a-zA-Z0-9\-_]+$/,
                message: 'id must be a valid HTML id',
            },
            children: {
                type: 'node',
                message: 'children must be a valid React node',
            },
            onClick: {
                type: 'function',
                message: 'onClick must be a function',
            },
            disabled: {
                type: 'boolean',
                message: 'disabled must be a boolean',
            },
            visible: {
                type: 'boolean',
                message: 'visible must be a boolean',
            },
        };
        this.validationRules.set(COMMON_RULE_SET, commonRules);
    };
    ComponentValidator.prototype.setupDeprecationWarnings = function () {
        var commonDeprecations = [
            {
                prop: 'onChange',
                replacement: 'onValueChange',
                version: '2.0.0',
                message: 'onChange is deprecated, use onValueChange instead',
                severity: 'warning',
            },
            {
                prop: 'onPress',
                replacement: 'onClick',
                version: '2.0.0',
                message: 'onPress is deprecated, use onClick instead',
                severity: 'warning',
            },
        ];
        this.deprecatedProps.set(COMMON_RULE_SET, commonDeprecations);
    };
    ComponentValidator.prototype.setupPerformanceWarnings = function () {
        var commonWarnings = [
            {
                prop: 'style',
                issue: 'Inline styles can cause performance issues',
                impact: 'medium',
                suggestion: 'Use CSS classes or styled-components instead',
            },
            {
                prop: 'onClick',
                issue: 'Inline functions can cause unnecessary re-renders',
                impact: 'high',
                suggestion: 'Use useCallback or move the function outside the component',
            },
            {
                prop: 'children',
                issue: 'Complex children can impact rendering performance',
                impact: 'low',
                suggestion: 'Consider memoizing complex children',
            },
        ];
        this.performanceWarnings.set(COMMON_RULE_SET, commonWarnings);
    };
    ComponentValidator.prototype.registerValidationRules = function (componentName, rules) {
        this.validationRules.set(componentName, rules);
        this.validationCache.clear();
    };
    ComponentValidator.prototype.registerDeprecatedProps = function (componentName, deprecated) {
        this.deprecatedProps.set(componentName, deprecated);
    };
    ComponentValidator.prototype.registerPerformanceWarnings = function (componentName, warnings) {
        this.performanceWarnings.set(componentName, warnings);
    };
    ComponentValidator.prototype.validateProps = function (componentName, props) {
        var cacheKey = this.createCacheKey(componentName, props);
        var cachedResult = this.validationCache.get(cacheKey);
        if (cachedResult) {
            return cachedResult;
        }
        var errors = [];
        var warnings = [];
        var rules = this.getMergedRules(componentName);
        var deprecatedProps = this.getMergedDeprecatedProps(componentName);
        var performanceWarnings = this.getMergedPerformanceWarnings(componentName);
        var _loop_1 = function (propName, value) {
            var rule = rules[propName];
            if (this_1.config.enablePropValidation && rule) {
                var validation = this_1.validateProp(propName, value, rule);
                errors.push.apply(errors, validation.errors);
                warnings.push.apply(warnings, validation.warnings);
            }
            if (this_1.config.enableDeprecationWarnings) {
                var deprecation = deprecatedProps.find(function (entry) { return entry.prop === propName; });
                if (deprecation) {
                    warnings.push({
                        prop: propName,
                        value: value,
                        message: deprecation.message,
                        suggestion: deprecation.replacement
                            ? "Use ".concat(deprecation.replacement, " instead")
                            : 'Remove this deprecated prop',
                    });
                }
            }
            if (this_1.config.enablePerformanceWarnings) {
                var warning = performanceWarnings.find(function (entry) { return entry.prop === propName; });
                if (warning && this_1.shouldEmitPerformanceWarning(propName, value)) {
                    warnings.push({
                        prop: propName,
                        value: value,
                        message: warning.issue,
                        suggestion: warning.suggestion,
                    });
                }
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = Object.entries(props); _i < _a.length; _i++) {
            var _b = _a[_i], propName = _b[0], value = _b[1];
            _loop_1(propName, value);
        }
        for (var _c = 0, _d = Object.entries(rules); _c < _d.length; _c++) {
            var _e = _d[_c], propName = _e[0], rule = _e[1];
            if (rule.required && !(propName in props)) {
                errors.push({
                    prop: propName,
                    value: undefined,
                    rule: rule,
                    message: "Required prop '".concat(propName, "' is missing"),
                    severity: 'error',
                });
            }
        }
        var result = {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings,
        };
        this.validationCache.set(cacheKey, result);
        return result;
    };
    ComponentValidator.prototype.createCacheKey = function (componentName, props) {
        try {
            return "".concat(componentName, ":").concat(JSON.stringify(props));
        }
        catch (_a) {
            return "".concat(componentName, ":").concat(Object.keys(props).sort().join('|'));
        }
    };
    ComponentValidator.prototype.getMergedRules = function (componentName) {
        var _a, _b;
        return __assign(__assign({}, ((_a = this.validationRules.get(COMMON_RULE_SET)) !== null && _a !== void 0 ? _a : {})), ((_b = this.validationRules.get(componentName)) !== null && _b !== void 0 ? _b : {}));
    };
    ComponentValidator.prototype.getMergedDeprecatedProps = function (componentName) {
        var _a, _b;
        return __spreadArray(__spreadArray([], ((_a = this.deprecatedProps.get(COMMON_RULE_SET)) !== null && _a !== void 0 ? _a : []), true), ((_b = this.deprecatedProps.get(componentName)) !== null && _b !== void 0 ? _b : []), true);
    };
    ComponentValidator.prototype.getMergedPerformanceWarnings = function (componentName) {
        var _a, _b;
        return __spreadArray(__spreadArray([], ((_a = this.performanceWarnings.get(COMMON_RULE_SET)) !== null && _a !== void 0 ? _a : []), true), ((_b = this.performanceWarnings.get(componentName)) !== null && _b !== void 0 ? _b : []), true);
    };
    ComponentValidator.prototype.shouldEmitPerformanceWarning = function (propName, value) {
        if (propName === 'style') {
            return typeof value === 'object' && value !== null;
        }
        if (propName.startsWith('on')) {
            return typeof value === 'function';
        }
        if (propName === 'children') {
            return Array.isArray(value) && value.length > 10;
        }
        return true;
    };
    ComponentValidator.prototype.validateProp = function (propName, value, rule) {
        var _a, _b;
        var errors = [];
        var warnings = [];
        if (value === undefined) {
            if (rule.required) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: "Required prop '".concat(propName, "' is undefined"),
                    severity: 'error',
                });
            }
            return { isValid: errors.length === 0, errors: errors, warnings: warnings };
        }
        if (this.config.enableTypeChecking) {
            var typeCheck = this.checkType(value, rule.type);
            if (!typeCheck.isValid) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: (_a = typeCheck.message) !== null && _a !== void 0 ? _a : "Prop '".concat(propName, "' must be of type ").concat(rule.type),
                    severity: 'error',
                });
                return { isValid: false, errors: errors, warnings: warnings };
            }
        }
        if (rule.type === 'string' && typeof value === 'string') {
            if (rule.min !== undefined && value.length < rule.min) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: "Prop '".concat(propName, "' must be at least ").concat(rule.min, " characters long"),
                    severity: 'error',
                });
            }
            if (rule.max !== undefined && value.length > rule.max) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: "Prop '".concat(propName, "' must be no more than ").concat(rule.max, " characters long"),
                    severity: 'error',
                });
            }
            if (rule.pattern && !rule.pattern.test(value)) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: (_b = rule.message) !== null && _b !== void 0 ? _b : "Prop '".concat(propName, "' does not match the required pattern"),
                    severity: 'error',
                });
            }
        }
        if (rule.type === 'number' && typeof value === 'number') {
            if (rule.min !== undefined && value < rule.min) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: "Prop '".concat(propName, "' must be at least ").concat(rule.min),
                    severity: 'error',
                });
            }
            if (rule.max !== undefined && value > rule.max) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: "Prop '".concat(propName, "' must be no more than ").concat(rule.max),
                    severity: 'error',
                });
            }
        }
        if (rule.type === 'array' && Array.isArray(value)) {
            if (rule.min !== undefined && value.length < rule.min) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: "Prop '".concat(propName, "' must contain at least ").concat(rule.min, " items"),
                    severity: 'error',
                });
            }
            if (rule.max !== undefined && value.length > rule.max) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: "Prop '".concat(propName, "' must contain no more than ").concat(rule.max, " items"),
                    severity: 'error',
                });
            }
        }
        if (rule.enum && !rule.enum.includes(value)) {
            errors.push({
                prop: propName,
                value: value,
                rule: rule,
                message: "Prop '".concat(propName, "' must be one of: ").concat(rule.enum.join(', ')),
                severity: 'error',
            });
        }
        if (rule.custom) {
            var customResult = rule.custom(value);
            if (customResult !== true) {
                errors.push({
                    prop: propName,
                    value: value,
                    rule: rule,
                    message: typeof customResult === 'string'
                        ? customResult
                        : "Prop '".concat(propName, "' failed custom validation"),
                    severity: 'error',
                });
            }
        }
        return { isValid: errors.length === 0, errors: errors, warnings: warnings };
    };
    ComponentValidator.prototype.checkType = function (value, expectedType) {
        switch (expectedType) {
            case 'string':
                return { isValid: typeof value === 'string' };
            case 'number':
                return { isValid: typeof value === 'number' && !Number.isNaN(value) };
            case 'boolean':
                return { isValid: typeof value === 'boolean' };
            case 'array':
                return { isValid: Array.isArray(value) };
            case 'object':
                return { isValid: typeof value === 'object' && value !== null && !Array.isArray(value) };
            case 'function':
                return { isValid: typeof value === 'function' };
            case 'element':
                return { isValid: react_1.default.isValidElement(value) };
            case 'node':
                return { isValid: this.isReactNode(value) };
            default:
                return { isValid: true };
        }
    };
    ComponentValidator.prototype.isReactNode = function (value) {
        var _this = this;
        if (value === null || value === undefined || typeof value === 'boolean') {
            return true;
        }
        if (typeof value === 'string' || typeof value === 'number') {
            return true;
        }
        if (react_1.default.isValidElement(value)) {
            return true;
        }
        if (Array.isArray(value)) {
            return value.every(function (item) { return _this.isReactNode(item); });
        }
        return false;
    };
    ComponentValidator.prototype.createValidationHOC = function (componentName, validationRules) {
        var _this = this;
        this.registerValidationRules(componentName, validationRules);
        return function (WrappedComponent) {
            var ValidatedComponent = function (props) {
                if (_this.config.enableRuntimeValidation) {
                    var validation = _this.validateProps(componentName, props);
                    if (!validation.isValid && (_this.config.logLevel === 'error' || _this.config.logLevel === 'warn')) {
                        console.error("Validation errors for ".concat(componentName, ":"), validation.errors);
                    }
                    if (validation.warnings.length > 0 &&
                        ['warn', 'info', 'debug'].includes(_this.config.logLevel)) {
                        console.warn("Validation warnings for ".concat(componentName, ":"), validation.warnings);
                    }
                }
                return react_1.default.createElement(WrappedComponent, props);
            };
            ValidatedComponent.displayName = "Validated(".concat(componentName, ")");
            return ValidatedComponent;
        };
    };
    ComponentValidator.prototype.createValidationHook = function (componentName, validationRules) {
        var _this = this;
        this.registerValidationRules(componentName, validationRules);
        return function (props) {
            var _a = react_1.default.useState({
                isValid: true,
                errors: [],
                warnings: [],
            }), validation = _a[0], setValidation = _a[1];
            react_1.default.useEffect(function () {
                if (_this.config.enableRuntimeValidation) {
                    setValidation(_this.validateProps(componentName, props));
                }
            }, [componentName, props]);
            return validation;
        };
    };
    ComponentValidator.prototype.getValidationStatistics = function () {
        var _a, _b;
        var allResults = Array.from(this.validationCache.values());
        var allErrors = allResults.flatMap(function (result) { return result.errors; });
        var allWarnings = allResults.flatMap(function (result) { return result.warnings; });
        var errorCounts = new Map();
        for (var _i = 0, allErrors_1 = allErrors; _i < allErrors_1.length; _i++) {
            var error = allErrors_1[_i];
            errorCounts.set(error.message, ((_a = errorCounts.get(error.message)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        var warningCounts = new Map();
        for (var _c = 0, allWarnings_1 = allWarnings; _c < allWarnings_1.length; _c++) {
            var warning = allWarnings_1[_c];
            warningCounts.set(warning.message, ((_b = warningCounts.get(warning.message)) !== null && _b !== void 0 ? _b : 0) + 1);
        }
        return {
            totalValidations: allResults.length,
            successfulValidations: allResults.filter(function (result) { return result.isValid; }).length,
            failedValidations: allResults.filter(function (result) { return !result.isValid; }).length,
            totalErrors: allErrors.length,
            totalWarnings: allWarnings.length,
            mostCommonErrors: Array.from(errorCounts.entries())
                .map(function (_a) {
                var error = _a[0], count = _a[1];
                return ({ error: error, count: count });
            })
                .sort(function (left, right) { return right.count - left.count; })
                .slice(0, 10),
            mostCommonWarnings: Array.from(warningCounts.entries())
                .map(function (_a) {
                var warning = _a[0], count = _a[1];
                return ({ warning: warning, count: count });
            })
                .sort(function (left, right) { return right.count - left.count; })
                .slice(0, 10),
        };
    };
    ComponentValidator.prototype.clearCache = function () {
        this.validationCache.clear();
    };
    ComponentValidator.prototype.updateConfig = function (newConfig) {
        this.config = __assign(__assign({}, this.config), newConfig);
    };
    ComponentValidator.prototype.getConfig = function () {
        return __assign({}, this.config);
    };
    ComponentValidator.prototype.destroy = function () {
        this.validationRules.clear();
        this.deprecatedProps.clear();
        this.performanceWarnings.clear();
        this.validationCache.clear();
    };
    return ComponentValidator;
}());
exports.componentValidator = new ComponentValidator();
var validateProps = function (componentName, props) {
    return exports.componentValidator.validateProps(componentName, props);
};
exports.validateProps = validateProps;
var registerValidationRules = function (componentName, rules) {
    exports.componentValidator.registerValidationRules(componentName, rules);
};
exports.registerValidationRules = registerValidationRules;
var createValidationHOC = function (componentName, validationRules) {
    return exports.componentValidator.createValidationHOC(componentName, validationRules);
};
exports.createValidationHOC = createValidationHOC;
var createValidationHook = function (componentName, validationRules) {
    return exports.componentValidator.createValidationHook(componentName, validationRules);
};
exports.createValidationHook = createValidationHook;
var getValidationStatistics = function () {
    return exports.componentValidator.getValidationStatistics();
};
exports.getValidationStatistics = getValidationStatistics;
exports.default = exports.componentValidator;
