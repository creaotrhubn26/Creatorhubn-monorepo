#import <Cocoa/Cocoa.h>

#include "ReviewConsole_GUI_Cocoa.hpp"

#include "CreatorHubReviewBridge.hpp"
#include "MacCredentialStore.hpp"

#include <atomic>
#include <chrono>
#include <exception>
#include <string>

namespace {

constexpr CGFloat ViewWidth = 720.0;
constexpr CGFloat ViewHeight = 500.0;

std::string RequestId() {
    static std::atomic<std::uint64_t> sequence{0};
    const auto now = std::chrono::steady_clock::now().time_since_epoch().count();
    return "aax-" + std::to_string(now) + "-" + std::to_string(++sequence);
}

NSString* PrettyResponse(const std::string& response) {
    NSData* data = [NSData dataWithBytes:response.data() length:response.size()];
    NSError* error = nil;
    id object = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
    if (object && !error) {
        NSData* pretty = [NSJSONSerialization dataWithJSONObject:object
                                                          options:NSJSONWritingPrettyPrinted
                                                            error:&error];
        if (pretty && !error) {
            return [[[NSString alloc] initWithData:pretty encoding:NSUTF8StringEncoding] autorelease];
        }
    }
    NSString* plain = [[[NSString alloc] initWithBytes:response.data()
                                                length:response.size()
                                              encoding:NSUTF8StringEncoding] autorelease];
    return plain ?: @"Ugyldig svar fra Companion";
}

NSString* JsonString(NSString* value) {
    if (!value) return @"\"\"";
    NSData* data = [NSJSONSerialization dataWithJSONObject:@[value] options:0 error:nil];
    NSString* array = [[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] autorelease];
    if (array.length < 2) return @"\"\"";
    return [array substringWithRange:NSMakeRange(1, array.length - 2)];
}

NSButton* MakeButton(NSString* title, id target, SEL action, NSRect frame) {
    NSButton* button = [[[NSButton alloc] initWithFrame:frame] autorelease];
    [button setTitle:title];
    [button setBezelStyle:NSBezelStyleRounded];
    [button setTarget:target];
    [button setAction:action];
    return button;
}

NSTextField* MakeLabel(NSString* value, NSRect frame, CGFloat size, BOOL bold) {
    NSTextField* label = [[[NSTextField alloc] initWithFrame:frame] autorelease];
    [label setStringValue:value];
    [label setEditable:NO];
    [label setSelectable:YES];
    [label setBordered:NO];
    [label setDrawsBackground:NO];
    [label setTextColor:[NSColor labelColor]];
    [label setFont:bold ? [NSFont boldSystemFontOfSize:size] : [NSFont systemFontOfSize:size]];
    return label;
}

} // namespace

@interface CreatorHubReviewController : NSViewController {
@private
    NSTextField* _status;
    NSTextView* _output;
    NSTextField* _commentId;
    NSTextField* _seconds;
    NSTextField* _reply;
    BOOL _requestInFlight;
}
@end

@implementation CreatorHubReviewController

- (instancetype)init {
    self = [super initWithNibName:nil bundle:nil];
    if (!self) return nil;

    NSView* root = [[[NSView alloc] initWithFrame:NSMakeRect(0, 0, ViewWidth, ViewHeight)] autorelease];
    [root setWantsLayer:YES];
    root.layer.backgroundColor = [[NSColor colorWithCalibratedRed:0.035 green:0.055 blue:0.10 alpha:1.0] CGColor];

    NSTextField* title = MakeLabel(@"CreatorHub Review Console", NSMakeRect(24, 452, 430, 28), 21, YES);
    title.textColor = [NSColor colorWithCalibratedRed:0.38 green:0.83 blue:1.0 alpha:1.0];
    [root addSubview:title];
    [root addSubview:MakeLabel(@"Sound Room-feedback og review direkte i Pro Tools", NSMakeRect(24, 425, 600, 22), 13, NO)];

    _status = MakeLabel(@"Kobler til Companion …", NSMakeRect(24, 394, 670, 22), 12, YES);
    [root addSubview:_status];

    [root addSubview:MakeButton(@"Oppdater", self, @selector(refreshPressed:), NSMakeRect(24, 352, 112, 32))];
    [root addSubview:MakeButton(@"Hent feedback", self, @selector(feedbackPressed:), NSMakeRect(144, 352, 126, 32))];
    [root addSubview:MakeButton(@"Ta snapshot", self, @selector(snapshotPressed:), NSMakeRect(278, 352, 112, 32))];
    [root addSubview:MakeButton(@"Send review", self, @selector(sendReviewPressed:), NSMakeRect(398, 352, 112, 32))];

    [root addSubview:MakeLabel(@"Kommentar-ID", NSMakeRect(24, 316, 118, 20), 11, NO)];
    _commentId = [[[NSTextField alloc] initWithFrame:NSMakeRect(24, 288, 220, 25)] autorelease];
    _commentId.placeholderString = @"Sound Room comment ID";
    [root addSubview:_commentId];
    [root addSubview:MakeLabel(@"Tid (sekunder)", NSMakeRect(254, 316, 110, 20), 11, NO)];
    _seconds = [[[NSTextField alloc] initWithFrame:NSMakeRect(254, 288, 96, 25)] autorelease];
    _seconds.placeholderString = @"12.5";
    [root addSubview:_seconds];
    [root addSubview:MakeButton(@"Finn", self, @selector(locatePressed:), NSMakeRect(360, 286, 72, 29))];
    [root addSubview:MakeButton(@"Marker", self, @selector(markPressed:), NSMakeRect(438, 286, 78, 29))];
    [root addSubview:MakeButton(@"Løs", self, @selector(resolvePressed:), NSMakeRect(522, 286, 72, 29))];

    _reply = [[[NSTextField alloc] initWithFrame:NSMakeRect(24, 250, 488, 25)] autorelease];
    _reply.placeholderString = @"Svar på valgt kommentar";
    [root addSubview:_reply];
    [root addSubview:MakeButton(@"Svar", self, @selector(replyPressed:), NSMakeRect(522, 248, 72, 29))];

    NSScrollView* scroll = [[[NSScrollView alloc] initWithFrame:NSMakeRect(24, 20, 672, 214)] autorelease];
    scroll.hasVerticalScroller = YES;
    scroll.borderType = NSBezelBorder;
    _output = [[[NSTextView alloc] initWithFrame:scroll.bounds] autorelease];
    _output.editable = NO;
    _output.selectable = YES;
    _output.font = [NSFont monospacedSystemFontOfSize:11 weight:NSFontWeightRegular];
    _output.textColor = [NSColor textColor];
    _output.backgroundColor = [NSColor textBackgroundColor];
    scroll.documentView = _output;
    [root addSubview:scroll];

    [self setView:root];
    [self performSelector:@selector(refreshPressed:) withObject:nil afterDelay:0.05];
    return self;
}

- (void)runAction:(NSString*)action payload:(NSString*)payload {
    if (_requestInFlight) return;
    _requestInFlight = YES;
    _status.stringValue = [NSString stringWithFormat:@"Utfører %@ …", action];
    NSString* actionCopy = [action copy];
    NSString* payloadCopy = [(payload ?: @"{}") copy];
    [self retain];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSString* display = nil;
        BOOL succeeded = NO;
        try {
            const std::string secret = creatorhub::aax::ReadLocalIpcSecretFromKeychain();
            creatorhub::CreatorHubReviewBridge bridge(secret);
            const std::string response = bridge.Send(
                RequestId(),
                std::string([actionCopy UTF8String]),
                std::string([payloadCopy UTF8String]));
            display = [PrettyResponse(response) copy];
            NSData* responseData = [NSData dataWithBytes:response.data() length:response.size()];
            NSDictionary* json = [NSJSONSerialization JSONObjectWithData:responseData options:0 error:nil];
            succeeded = [json isKindOfClass:[NSDictionary class]] && [json[@"ok"] boolValue];
        } catch (const std::exception& error) {
            display = [[NSString alloc] initWithUTF8String:error.what()];
        } catch (...) {
            display = [@"Ukjent feil i Review Console" copy];
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            self->_requestInFlight = NO;
            self->_status.stringValue = succeeded
                ? @"Tilkoblet CreatorHub Companion"
                : @"Handlingen feilet – se svaret under";
            self->_status.textColor = succeeded
                ? [NSColor colorWithCalibratedRed:0.25 green:0.78 blue:0.48 alpha:1.0]
                : [NSColor systemOrangeColor];
            self->_output.string = display ?: @"Tomt svar";
            [display release];
            [actionCopy release];
            [payloadCopy release];
            [self release];
        });
    });
}

- (void)refreshPressed:(id)sender { (void)sender; [self runAction:@"state" payload:@"{}"]; }
- (void)feedbackPressed:(id)sender { (void)sender; [self runAction:@"feedback" payload:@"{}"]; }
- (void)snapshotPressed:(id)sender { (void)sender; [self runAction:@"snapshot" payload:@"{}"]; }
- (void)sendReviewPressed:(id)sender {
    (void)sender;
    [self runAction:@"send_review" payload:@"{\"fileName\":\"CreatorHub Review.wav\"}"];
}
- (void)locatePressed:(id)sender {
    (void)sender;
    [self runAction:@"locate" payload:[NSString stringWithFormat:@"{\"seconds\":%.3f}", _seconds.doubleValue]];
}
- (void)markPressed:(id)sender {
    (void)sender;
    NSString* payload = [NSString stringWithFormat:
        @"{\"commentId\":%@,\"seconds\":%.3f,\"name\":\"Sound Room feedback\",\"category\":\"mix\"}",
        JsonString(_commentId.stringValue), _seconds.doubleValue];
    [self runAction:@"mark" payload:payload];
}
- (void)resolvePressed:(id)sender {
    (void)sender;
    [self runAction:@"resolve" payload:[NSString stringWithFormat:@"{\"commentId\":%@}", JsonString(_commentId.stringValue)]];
}
- (void)replyPressed:(id)sender {
    (void)sender;
    NSString* payload = [NSString stringWithFormat:@"{\"commentId\":%@,\"body\":%@}",
        JsonString(_commentId.stringValue), JsonString(_reply.stringValue)];
    [self runAction:@"reply" payload:payload];
}

@end

namespace creatorhub::aax {

AAX_IEffectGUI* AAX_CALLBACK ReviewConsoleGUI::Create() {
    return new ReviewConsoleGUI();
}

void ReviewConsoleGUI::CreateViewContents() {
    SetViewController([[CreatorHubReviewController alloc] init]);
}

} // namespace creatorhub::aax
