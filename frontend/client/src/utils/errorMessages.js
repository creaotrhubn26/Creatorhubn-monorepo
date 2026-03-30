"use strict";
/**
 * User-friendly error messages with contextual guidance and statistics.
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
exports.formatErrorMessage = exports.useErrorMessage = exports.clearErrorHistory = exports.getErrorStatistics = exports.addCustomErrorMessage = exports.getErrorMessage = exports.errorMessageManager = void 0;
var react_1 = require("react");
var isDevelopmentEnvironment = function () {
    var _a;
    if (typeof import.meta !== 'undefined' && ((_a = import.meta.env) === null || _a === void 0 ? void 0 : _a.MODE)) {
        return import.meta.env.MODE === 'development';
    }
    return typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
};
var createTemplate = function (pattern, message) { return ({
    pattern: pattern,
    message: message,
}); };
var ErrorMessageManager = /** @class */ (function () {
    function ErrorMessageManager() {
        this.templates = [];
        this.customMessages = new Map();
        this.contextHistory = new Map();
        this.initializeDefaultTemplates();
    }
    ErrorMessageManager.prototype.initializeDefaultTemplates = function () {
        this.templates = [
            createTemplate(/network error|fetch failed|connection refused/i, {
                id: 'network_error',
                title: 'Connection Problem',
                message: "We're having trouble connecting to our servers. This might be a temporary issue.",
                action: 'Please check your internet connection and try again.',
                severity: 'error',
                category: 'network',
                retryable: true,
                autoRetry: true,
                retryDelay: 3000,
                suggestions: [
                    'Check your internet connection',
                    'Try refreshing the page',
                    'Wait a moment and try again',
                    'Contact support if the problem persists',
                ],
                helpUrl: '/help/network-issues',
            }),
            createTemplate(/timeout|request timed out?/i, {
                id: 'timeout_error',
                title: 'Request Timed Out',
                message: 'The request is taking longer than expected to complete.',
                action: 'Please try again with a smaller file or simpler operation.',
                severity: 'warning',
                category: 'network',
                retryable: true,
                suggestions: [
                    'Try with a smaller file',
                    'Check your internet speed',
                    'Try again in a few minutes',
                    'Contact support if timeouts persist',
                ],
                helpUrl: '/help/timeout-issues',
            }),
            createTemplate(/validation failed|invalid input|required field/i, {
                id: 'validation_error',
                title: 'Invalid Input',
                message: 'Some of the information you entered is not valid.',
                action: 'Please check the highlighted fields and correct any errors.',
                severity: 'warning',
                category: 'validation',
                retryable: false,
                suggestions: [
                    'Check all required fields are filled',
                    'Verify email addresses are correct',
                    'Ensure passwords meet requirements',
                    'Check file formats are supported',
                ],
                helpUrl: '/help/validation-errors',
            }),
            createTemplate(/file too large|size limit exceeded/i, {
                id: 'file_size_error',
                title: 'File Too Large',
                message: "The file you're trying to upload is larger than the allowed limit.",
                action: 'Please compress the file or choose a smaller one.',
                severity: 'warning',
                category: 'validation',
                retryable: false,
                suggestions: [
                    'Compress the file using an image editor',
                    'Try a different file format',
                    'Split large files into smaller parts',
                    'Contact support for large file uploads',
                ],
                helpUrl: '/help/file-size-limits',
            }),
            createTemplate(/unauthorized|access denied|permission denied/i, {
                id: 'permission_error',
                title: 'Access Denied',
                message: "You don't have permission to perform this action.",
                action: 'Please contact your administrator or try logging in again.',
                severity: 'error',
                category: 'permission',
                retryable: false,
                suggestions: [
                    "Check if you're logged in correctly",
                    'Contact your administrator',
                    'Try refreshing the page',
                    'Log out and log back in',
                ],
                helpUrl: '/help/permissions',
            }),
            createTemplate(/forbidden|insufficient privileges/i, {
                id: 'forbidden_error',
                title: 'Action Not Allowed',
                message: 'This action is not allowed for your account type.',
                action: 'Please contact your administrator to upgrade your account.',
                severity: 'error',
                category: 'permission',
                retryable: false,
                suggestions: [
                    'Contact your administrator',
                    'Check your account permissions',
                    'Upgrade your account plan',
                    'Review the feature requirements',
                ],
                helpUrl: '/help/account-permissions',
            }),
            createTemplate(/internal server error|server error|\b500\b/i, {
                id: 'server_error',
                title: 'Server Error',
                message: "Something went wrong on our end. We're working to fix it.",
                action: 'Please try again in a few minutes.',
                severity: 'error',
                category: 'system',
                retryable: true,
                autoRetry: true,
                retryDelay: 5000,
                suggestions: [
                    'Wait a few minutes and try again',
                    'Check our status page for updates',
                    'Contact support if the error persists',
                    'Try a different browser or device',
                ],
                helpUrl: '/help/server-errors',
            }),
            createTemplate(/service unavailable|maintenance mode/i, {
                id: 'service_unavailable',
                title: 'Service Temporarily Unavailable',
                message: "We're performing maintenance to improve the service.",
                action: 'Please try again later.',
                severity: 'info',
                category: 'system',
                retryable: true,
                suggestions: [
                    'Check our status page for updates',
                    'Follow us on social media for announcements',
                    'Try again in a few hours',
                    'Contact support for urgent issues',
                ],
                helpUrl: '/help/maintenance',
            }),
            createTemplate(/not found|\b404\b|resource not found/i, {
                id: 'not_found_error',
                title: 'Page Not Found',
                message: "The page or resource you're looking for doesn't exist.",
                action: 'Please check the URL or navigate to a different page.',
                severity: 'warning',
                category: 'user',
                retryable: false,
                suggestions: [
                    'Check the URL for typos',
                    'Use the navigation menu',
                    'Search for what you need',
                    'Contact support if you think this is an error',
                ],
                helpUrl: '/help/navigation',
            }),
            createTemplate(/rate limit|too many requests|\b429\b/i, {
                id: 'rate_limit_error',
                title: 'Too Many Requests',
                message: "You're making requests too quickly. Please slow down.",
                action: 'Wait a moment before trying again.',
                severity: 'warning',
                category: 'user',
                retryable: true,
                retryDelay: 1000,
                retryAfter: 1000,
                suggestions: [
                    'Wait a few seconds before trying again',
                    'Avoid rapid clicking or refreshing',
                    'Check if you have multiple tabs open',
                    'Contact support if you need higher limits',
                ],
                helpUrl: '/help/rate-limits',
            }),
            createTemplate(/security|malware|virus detected/i, {
                id: 'security_error',
                title: 'Security Issue Detected',
                message: 'A potential security issue was detected with your file.',
                action: 'Please choose a different file or contact support.',
                severity: 'critical',
                category: 'security',
                retryable: false,
                suggestions: [
                    'Choose a different file',
                    'Scan your computer for malware',
                    'Contact support for assistance',
                    'Review our security guidelines',
                ],
                helpUrl: '/help/security',
            }),
            createTemplate(/suspicious|blocked|quarantine/i, {
                id: 'suspicious_content',
                title: 'Content Blocked',
                message: "The content you're trying to upload has been blocked for security reasons.",
                action: 'Please review our content guidelines and try a different file.',
                severity: 'error',
                category: 'security',
                retryable: false,
                suggestions: [
                    'Review our content guidelines',
                    'Choose a different file',
                    'Contact support for review',
                    'Check file permissions and format',
                ],
                helpUrl: '/help/content-guidelines',
            }),
        ];
    };
    ErrorMessageManager.prototype.addTemplate = function (template) {
        this.templates.push(template);
    };
    ErrorMessageManager.prototype.addCustomMessage = function (key, message) {
        this.customMessages.set(key, message);
    };
    ErrorMessageManager.prototype.getErrorMessage = function (error, context) {
        if (typeof error === 'string') {
            var customMessage = this.customMessages.get(error);
            if (customMessage) {
                return customMessage;
            }
        }
        var errorString = this.errorToString(error);
        for (var _i = 0, _a = this.templates; _i < _a.length; _i++) {
            var template = _a[_i];
            if (template.pattern.test(errorString)) {
                if (!template.condition || template.condition(error, context)) {
                    return this.enhanceMessage(template.message, error, context);
                }
            }
        }
        return this.createGenericErrorMessage(error, context);
    };
    ErrorMessageManager.prototype.errorToString = function (error) {
        if (typeof error === 'string')
            return error;
        if (error instanceof Error)
            return error.message;
        if (typeof error === 'object' && error !== null) {
            var objectError = error;
            if (typeof objectError.message === 'string')
                return objectError.message;
            if (typeof objectError.error === 'string')
                return objectError.error;
            if (typeof objectError.statusText === 'string')
                return objectError.statusText;
        }
        if (error === null || error === undefined) {
            return 'Unknown error';
        }
        return String(error);
    };
    ErrorMessageManager.prototype.enhanceMessage = function (message, error, context) {
        var suggestions = __spreadArray([], message.suggestions, true);
        if (context.operation === 'file_upload' && !suggestions.includes('Try compressing the file first')) {
            suggestions.unshift('Try compressing the file first');
        }
        if (context.operation === 'api_request' && !suggestions.includes('Check your internet connection')) {
            suggestions.unshift('Check your internet connection');
        }
        if (context.component === 'VisualEditor' && !suggestions.includes('Try saving your work and refreshing')) {
            suggestions.unshift('Try saving your work and refreshing');
        }
        return __assign(__assign({}, message), { suggestions: suggestions, technicalDetails: isDevelopmentEnvironment()
                ? this.getTechnicalDetails(error, context)
                : message.technicalDetails });
    };
    ErrorMessageManager.prototype.createGenericErrorMessage = function (error, context) {
        var summary = this.errorToString(error);
        var suggestions = [
            'Try refreshing the page',
            'Check your internet connection',
            'Clear your browser cache',
            'Contact support with error details',
        ];
        if (summary !== 'Unknown error') {
            suggestions.push("If you contact support, mention: ".concat(summary.slice(0, 80)));
        }
        return {
            id: 'generic_error',
            title: 'Something Went Wrong',
            message: "An unexpected error occurred. We're sorry for the inconvenience.",
            action: 'Please try again or contact support if the problem persists.',
            severity: 'error',
            category: 'system',
            retryable: true,
            autoRetry: false,
            suggestions: suggestions,
            helpUrl: '/help/contact-support',
            technicalDetails: isDevelopmentEnvironment()
                ? this.getTechnicalDetails(error, context)
                : undefined,
        };
    };
    ErrorMessageManager.prototype.getTechnicalDetails = function (error, context) {
        var _a, _b, _c;
        var stack = error instanceof Error ? error.stack : undefined;
        return [
            "Error: ".concat(this.errorToString(error)),
            "Operation: ".concat(context.operation),
            "Component: ".concat((_a = context.component) !== null && _a !== void 0 ? _a : 'Unknown'),
            "Timestamp: ".concat(new Date(context.timestamp).toISOString()),
            "User ID: ".concat((_b = context.userId) !== null && _b !== void 0 ? _b : 'Anonymous'),
            "Metadata: ".concat(JSON.stringify((_c = context.metadata) !== null && _c !== void 0 ? _c : {}, null, 2)),
            "Stack: ".concat(stack !== null && stack !== void 0 ? stack : 'No stack trace available'),
        ].join('\n');
    };
    ErrorMessageManager.prototype.trackErrorContext = function (error, context) {
        var _a;
        var errorString = this.errorToString(error);
        var contexts = (_a = this.contextHistory.get(errorString)) !== null && _a !== void 0 ? _a : [];
        contexts.push(context);
        this.contextHistory.set(errorString, contexts);
    };
    ErrorMessageManager.prototype.getErrorStatistics = function () {
        var _a, _b;
        var stats = {
            totalErrors: 0,
            errorsByCategory: {},
            errorsBySeverity: {},
            mostCommonErrors: [],
            retryableErrors: 0,
            autoRetryableErrors: 0,
        };
        for (var _i = 0, _c = this.contextHistory.entries(); _i < _c.length; _i++) {
            var _d = _c[_i], errorString = _d[0], contexts = _d[1];
            if (contexts.length === 0) {
                continue;
            }
            stats.totalErrors += contexts.length;
            var message = this.getErrorMessage(errorString, contexts[0]);
            stats.errorsByCategory[message.category] = ((_a = stats.errorsByCategory[message.category]) !== null && _a !== void 0 ? _a : 0) + contexts.length;
            stats.errorsBySeverity[message.severity] = ((_b = stats.errorsBySeverity[message.severity]) !== null && _b !== void 0 ? _b : 0) + contexts.length;
            if (message.retryable) {
                stats.retryableErrors += contexts.length;
            }
            if (message.autoRetry) {
                stats.autoRetryableErrors += contexts.length;
            }
        }
        stats.mostCommonErrors = Array.from(this.contextHistory.entries())
            .map(function (_a) {
            var error = _a[0], contexts = _a[1];
            return ({ error: error, count: contexts.length });
        })
            .sort(function (left, right) { return right.count - left.count; })
            .slice(0, 10);
        return stats;
    };
    ErrorMessageManager.prototype.clearErrorHistory = function () {
        this.contextHistory.clear();
    };
    ErrorMessageManager.prototype.getHelpUrl = function (category) {
        var _a;
        var helpUrls = {
            network: '/help/network-issues',
            validation: '/help/validation-errors',
            permission: '/help/permissions',
            system: '/help/server-errors',
            user: '/help/user-guide',
            security: '/help/security',
        };
        return (_a = helpUrls[category]) !== null && _a !== void 0 ? _a : '/help/contact-support';
    };
    return ErrorMessageManager;
}());
exports.errorMessageManager = new ErrorMessageManager();
var getErrorMessage = function (error, context) {
    exports.errorMessageManager.trackErrorContext(error, context);
    return exports.errorMessageManager.getErrorMessage(error, context);
};
exports.getErrorMessage = getErrorMessage;
var addCustomErrorMessage = function (key, message) {
    exports.errorMessageManager.addCustomMessage(key, message);
};
exports.addCustomErrorMessage = addCustomErrorMessage;
var getErrorStatistics = function () {
    return exports.errorMessageManager.getErrorStatistics();
};
exports.getErrorStatistics = getErrorStatistics;
var clearErrorHistory = function () {
    exports.errorMessageManager.clearErrorHistory();
};
exports.clearErrorHistory = clearErrorHistory;
var useErrorMessage = function () {
    var _a = react_1.default.useState([]), errorHistory = _a[0], setErrorHistory = _a[1];
    var handleError = react_1.default.useCallback(function (error, context) {
        var resolvedMessage = (0, exports.getErrorMessage)(error, context);
        setErrorHistory(function (previousHistory) { return __spreadArray([resolvedMessage], previousHistory.slice(0, 9), true); });
        return resolvedMessage;
    }, []);
    var clearHistory = react_1.default.useCallback(function () {
        setErrorHistory([]);
        (0, exports.clearErrorHistory)();
    }, []);
    return {
        handleError: handleError,
        errorHistory: errorHistory,
        clearHistory: clearHistory,
        getStatistics: exports.getErrorStatistics,
    };
};
exports.useErrorMessage = useErrorMessage;
var formatErrorMessage = function (message) {
    return {
        title: message.title,
        description: message.message,
        action: message.action,
        suggestions: message.suggestions,
        severity: message.severity,
        retryable: message.retryable,
        helpUrl: message.helpUrl,
    };
};
exports.formatErrorMessage = formatErrorMessage;
exports.default = exports.errorMessageManager;
