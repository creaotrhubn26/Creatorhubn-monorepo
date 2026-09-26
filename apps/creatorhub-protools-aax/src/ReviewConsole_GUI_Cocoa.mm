#import <Cocoa/Cocoa.h>

#include "ReviewConsole_GUI_Cocoa.hpp"

#include "CreatorHubReviewBridge.hpp"
#include "MacCredentialStore.hpp"
#include "ReviewConsole_Algorithm.hpp"

#include <atomic>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <exception>
#include <string>

namespace {

constexpr CGFloat ViewWidth = 920.0;
constexpr CGFloat ViewHeight = 680.0;
constexpr CGFloat TouchHeight = 44.0;

NSColor* Color(CGFloat red, CGFloat green, CGFloat blue, CGFloat alpha = 1.0) {
    return [NSColor colorWithCalibratedRed:red green:green blue:blue alpha:alpha];
}

NSColor* Background() { return Color(0.055, 0.075, 0.125); }
NSColor* Panel() { return Color(0.086, 0.11, 0.17); }
NSColor* Orange() { return Color(1.0, 0.55, 0.0); }
NSColor* Green() { return Color(0.37, 0.72, 0.54); }
NSColor* Blue() { return Color(0.25, 0.65, 0.84); }
NSColor* Muted() { return Color(0.62, 0.69, 0.78); }

std::string RequestId() {
    static std::atomic<std::uint64_t> sequence{0};
    const auto now = std::chrono::steady_clock::now().time_since_epoch().count();
    return "aax-" + std::to_string(now) + "-" + std::to_string(++sequence);
}

NSString* JSONPayload(NSDictionary* payload) {
    NSData* data = [NSJSONSerialization dataWithJSONObject:(payload ?: @{}) options:0 error:nil];
    return data ? [[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] autorelease] : @"{}";
}

NSString* PrettyJSON(id object) {
    if (!object || ![NSJSONSerialization isValidJSONObject:object]) return [object description] ?: @"";
    NSData* data = [NSJSONSerialization dataWithJSONObject:object options:NSJSONWritingPrettyPrinted error:nil];
    return data ? [[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] autorelease] : @"";
}

NSString* Text(id value, NSString* fallback = @"") {
    return [value isKindOfClass:[NSString class]] && [value length] ? value : fallback;
}

NSArray* Array(id value) { return [value isKindOfClass:[NSArray class]] ? value : @[]; }
NSDictionary* Dictionary(id value) { return [value isKindOfClass:[NSDictionary class]] ? value : @{}; }

NSString* FriendlyError(NSString* error) {
    if (!error.length) return @"Noe gikk galt. Prøv én gang til.";
    if ([error containsString:@"not_paired"] || [error containsString:@"ikke paret"])
        return @"Koble Companion til CreatorHub Workspace først.";
    if ([error containsString:@"session_missing"] || [error containsString:@"Ingen aktiv"])
        return @"Velg en Pro Tools-sesjon i Companion først.";
    if ([error containsString:@"authentication"])
        return @"Den sikre forbindelsen må fornyes. Start Companion på nytt.";
    if ([error containsString:@"not listening"])
        return @"Companion svarer ikke ennå. Vent et øyeblikk og trykk Prøv igjen.";
    if ([error containsString:@"snapshot_not_found"])
        return @"Snapshotet finnes ikke lenger. Oppdater listen.";
    return error;
}

NSString* Timecode(id raw) {
    const double seconds = [raw respondsToSelector:@selector(doubleValue)] ? std::max(0.0, [raw doubleValue]) : 0.0;
    const NSInteger hours = static_cast<NSInteger>(seconds) / 3600;
    const NSInteger minutes = (static_cast<NSInteger>(seconds) / 60) % 60;
    const NSInteger secs = static_cast<NSInteger>(seconds) % 60;
    return hours > 0
        ? [NSString stringWithFormat:@"%ld:%02ld:%02ld", (long)hours, (long)minutes, (long)secs]
        : [NSString stringWithFormat:@"%ld:%02ld", (long)minutes, (long)secs];
}

NSString* Decibels(float linear) {
    if (linear <= 0.000001F) return @"−∞ dBFS";
    return [NSString stringWithFormat:@"%.1f dBFS", 20.0 * std::log10(linear)];
}

NSString* SafeBaseName(NSString* input) {
    NSMutableString* result = [NSMutableString string];
    NSCharacterSet* allowed = [NSCharacterSet characterSetWithCharactersInString:@"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ÆØÅæøå ._-"];
    for (NSUInteger index = 0; index < input.length; ++index) {
        unichar character = [input characterAtIndex:index];
        [result appendString:[allowed characterIsMember:character] ? [NSString stringWithCharacters:&character length:1] : @"_"];
    }
    return result.length ? result : @"Mix";
}

NSString* StatusLabel(NSString* value) {
    NSDictionary* labels = @{
        @"under_review": @"Til vurdering", @"approved": @"Godkjent",
        @"superseded": @"Tidligere", @"draft": @"Kladd",
        @"completed": @"Ferdig", @"running": @"Pågår", @"queued": @"Venter",
        @"failed": @"Stoppet", @"cancelled": @"Avbrutt",
    };
    return labels[value] ?: (value.length ? value : @"Ukjent");
}

NSString* SnapshotReason(NSString* value) {
    NSDictionary* labels = @{
        @"pre_publish": @"Før publisering", @"manual": @"Laget manuelt",
        @"pre_recall": @"Sikkerhetskopi før recall", @"post_recall": @"Etter recall",
        @"intro_copy": @"Intro-sikker kopi", @"session_changed": @"Sesjonen ble endret",
    };
    return labels[value] ?: @"Lagret automatisk";
}

NSTextField* Label(NSString* value, NSRect frame, CGFloat size, BOOL bold) {
    NSTextField* label = [[[NSTextField alloc] initWithFrame:frame] autorelease];
    label.stringValue = value ?: @"";
    label.editable = NO;
    label.selectable = NO;
    label.bordered = NO;
    label.drawsBackground = NO;
    label.textColor = bold ? [NSColor labelColor] : Muted();
    label.font = bold ? [NSFont systemFontOfSize:size weight:NSFontWeightSemibold]
                      : [NSFont systemFontOfSize:size weight:NSFontWeightRegular];
    label.lineBreakMode = NSLineBreakByTruncatingTail;
    return label;
}

NSTextField* Field(NSString* placeholder, NSRect frame) {
    NSTextField* field = [[[NSTextField alloc] initWithFrame:frame] autorelease];
    field.placeholderString = placeholder;
    field.font = [NSFont systemFontOfSize:13];
    field.focusRingType = NSFocusRingTypeExterior;
    return field;
}

NSButton* Button(NSString* title, id target, SEL action, NSRect frame, BOOL primary) {
    NSButton* button = [[[NSButton alloc] initWithFrame:frame] autorelease];
    button.title = title;
    button.target = target;
    button.action = action;
    button.bezelStyle = NSBezelStyleRounded;
    button.font = [NSFont systemFontOfSize:13 weight:primary ? NSFontWeightSemibold : NSFontWeightMedium];
    button.keyEquivalent = @"";
    button.accessibilityLabel = title;
    button.toolTip = title;
    button.contentTintColor = primary ? Orange() : [NSColor labelColor];
    return button;
}

NSView* Card(NSRect frame) {
    NSView* view = [[[NSView alloc] initWithFrame:frame] autorelease];
    view.wantsLayer = YES;
    view.layer.backgroundColor = Panel().CGColor;
    view.layer.cornerRadius = 12.0;
    view.layer.borderWidth = 1.0;
    view.layer.borderColor = Color(1, 1, 1, 0.08).CGColor;
    return view;
}

NSTableView* Table(NSString* identifier, NSString* heading, id owner, NSRect frame, NSView* parent) {
    NSScrollView* scroll = [[[NSScrollView alloc] initWithFrame:frame] autorelease];
    scroll.hasVerticalScroller = YES;
    scroll.drawsBackground = NO;
    scroll.borderType = NSNoBorder;
    NSTableView* table = [[[NSTableView alloc] initWithFrame:scroll.bounds] autorelease];
    table.identifier = identifier;
    table.headerView = nil;
    table.backgroundColor = [NSColor clearColor];
    table.rowHeight = 50.0;
    table.selectionHighlightStyle = NSTableViewSelectionHighlightStyleRegular;
    table.delegate = owner;
    table.dataSource = owner;
    NSTableColumn* column = [[[NSTableColumn alloc] initWithIdentifier:@"main"] autorelease];
    column.title = heading;
    column.width = frame.size.width - 20.0;
    [table addTableColumn:column];
    scroll.documentView = table;
    [parent addSubview:scroll];
    return table;
}

} // namespace

@interface CreatorHubReviewController : NSViewController <NSTableViewDataSource, NSTableViewDelegate> {
@private
    NSTextField* _projectTitle;
    NSTextField* _versionTitle;
    NSTextField* _connectionStatus;
    NSTextField* _signalStatus;
    NSTextField* _globalMessage;
    NSSegmentedControl* _sections;
    NSTabView* _tabs;

    NSArray* _comments;
    NSArray* _versions;
    NSArray* _snapshots;
    NSArray* _sources;
    NSArray* _jobs;
    NSTableView* _commentTable;
    NSTableView* _versionTable;
    NSTableView* _snapshotTable;
    NSTableView* _jobTable;
    NSTextField* _reviewSummary;
    NSTextField* _replyField;
    NSButton* _locateButton;
    NSButton* _markerButton;
    NSButton* _resolveButton;
    NSButton* _replyButton;

    NSTextField* _reviewName;
    NSPopUpButton* _reviewSource;
    NSTextField* _qcSummary;
    NSButton* _sendButton;
    NSButton* _forceButton;

    NSButton* _compareButton;
    NSButton* _recallButton;
    NSString* _pendingSnapshotId;

    NSPopUpButton* _deliveryPreset;
    NSTextField* _deliveryFolder;
    NSMutableArray* _deliveryChecks;
    NSMutableArray* _deliverySources;
    NSButton* _deliveryButton;

    NSTextField* _diagnosticSummary;
    NSTextField* _diagnosticChecklist;
    NSScrollView* _technicalScroll;
    NSTextView* _technicalText;

    NSTimer* _uiTimer;
    NSInteger _pollTicks;
    NSInteger _bootstrapStep;
    BOOL _requestInFlight;
    NSString* _activeAction;
}
@end

@implementation CreatorHubReviewController

- (instancetype)init {
    self = [super initWithNibName:nil bundle:nil];
    if (!self) return nil;
    _comments = [@[] retain];
    _versions = [@[] retain];
    _snapshots = [@[] retain];
    _sources = [@[] retain];
    _jobs = [@[] retain];
    _deliveryChecks = [[NSMutableArray alloc] init];
    _deliverySources = [[NSMutableArray alloc] init];
    _bootstrapStep = 0;

    NSView* root = [[[NSView alloc] initWithFrame:NSMakeRect(0, 0, ViewWidth, ViewHeight)] autorelease];
    root.wantsLayer = YES;
    root.layer.backgroundColor = Background().CGColor;
    if (@available(macOS 10.14, *)) root.appearance = [NSAppearance appearanceNamed:NSAppearanceNameDarkAqua];

    NSTextField* brand = Label(@"CREATORHUB", NSMakeRect(24, 646, 170, 20), 11, YES);
    brand.textColor = Orange();
    [root addSubview:brand];
    _projectTitle = Label(@"Gjør ferdig miksen", NSMakeRect(24, 615, 400, 30), 22, YES);
    [root addSubview:_projectTitle];
    _versionTitle = Label(@"Kobler til Sound Room …", NSMakeRect(24, 590, 430, 22), 12, NO);
    [root addSubview:_versionTitle];

    _connectionStatus = Label(@"● Sjekker tilkoblingen", NSMakeRect(512, 640, 380, 20), 12, YES);
    _connectionStatus.alignment = NSTextAlignmentRight;
    _connectionStatus.textColor = Muted();
    [root addSubview:_connectionStatus];
    _signalStatus = Label(@"Signal: venter", NSMakeRect(512, 614, 380, 20), 11, NO);
    _signalStatus.alignment = NSTextAlignmentRight;
    [root addSubview:_signalStatus];

    _sections = [[[NSSegmentedControl alloc] initWithFrame:NSMakeRect(24, 548, 872, 38)] autorelease];
    _sections.segmentCount = 5;
    NSArray* sectionNames = @[@"Tilbakemeldinger", @"Send miks", @"Versjoner", @"Leveranse", @"Hjelp"];
    for (NSInteger index = 0; index < _sections.segmentCount; ++index) {
        [_sections setLabel:sectionNames[index] forSegment:index];
        [_sections setWidth:174 forSegment:index];
    }
    _sections.selectedSegment = 0;
    _sections.target = self;
    _sections.action = @selector(sectionChanged:);
    _sections.accessibilityLabel = @"Velg arbeidsområde";
    [root addSubview:_sections];

    _tabs = [[[NSTabView alloc] initWithFrame:NSMakeRect(20, 54, 880, 484)] autorelease];
    _tabs.tabViewType = NSNoTabsNoBorder;
    [_tabs addTabViewItem:[self reviewTab]];
    [_tabs addTabViewItem:[self publishTab]];
    [_tabs addTabViewItem:[self versionsTab]];
    [_tabs addTabViewItem:[self deliveryTab]];
    [_tabs addTabViewItem:[self helpTab]];
    [root addSubview:_tabs];

    _globalMessage = Label(@"Vi gjør klar alt du trenger.", NSMakeRect(24, 18, 872, 24), 12, YES);
    _globalMessage.textColor = Muted();
    [root addSubview:_globalMessage];

    [self setView:root];
    _uiTimer = [[NSTimer scheduledTimerWithTimeInterval:0.5 target:self selector:@selector(timerTick:) userInfo:nil repeats:YES] retain];
    [self performSelector:@selector(beginBootstrap) withObject:nil afterDelay:0.08];
    return self;
}

- (void)dealloc {
    [_uiTimer invalidate];
    [_uiTimer release];
    [_comments release]; [_versions release]; [_snapshots release]; [_sources release]; [_jobs release];
    [_deliveryChecks release]; [_deliverySources release];
    [_pendingSnapshotId release]; [_activeAction release];
    [super dealloc];
}

- (NSTabViewItem*)tabItem:(NSString*)name view:(NSView*)view {
    NSTabViewItem* item = [[[NSTabViewItem alloc] initWithIdentifier:name] autorelease];
    item.view = view;
    return item;
}

- (NSTabViewItem*)reviewTab {
    NSView* view = Card(NSMakeRect(0, 0, 880, 484));
    [view addSubview:Label(@"Dette må du gjøre", NSMakeRect(20, 446, 260, 24), 16, YES)];
    _reviewSummary = Label(@"Henter kommentarer, oppgaver og låtinfo …", NSMakeRect(20, 386, 840, 56), 12, NO);
    _reviewSummary.maximumNumberOfLines = 3;
    _reviewSummary.lineBreakMode = NSLineBreakByWordWrapping;
    [view addSubview:_reviewSummary];
    _commentTable = Table(@"comments", @"Kommentarer", self, NSMakeRect(16, 112, 848, 268), view);
    _commentTable.accessibilityLabel = @"Tilbakemeldinger fra Sound Room";
    [view addSubview:Button(@"Neste kommentar", self, @selector(nextComment:), NSMakeRect(20, 58, 148, TouchHeight), YES)];
    _locateButton = Button(@"Finn i Pro Tools", self, @selector(locateComment:), NSMakeRect(178, 58, 132, TouchHeight), NO);
    _markerButton = Button(@"Lag markør", self, @selector(markComment:), NSMakeRect(320, 58, 112, TouchHeight), NO);
    _resolveButton = Button(@"Marker som løst", self, @selector(resolveComment:), NSMakeRect(442, 58, 142, TouchHeight), NO);
    [view addSubview:_locateButton]; [view addSubview:_markerButton]; [view addSubview:_resolveButton];
    _replyField = Field(@"Skriv et kort svar …", NSMakeRect(20, 16, 700, 34));
    _replyField.accessibilityLabel = @"Svar på valgt kommentar";
    [view addSubview:_replyField];
    _replyButton = Button(@"Send svar", self, @selector(replyComment:), NSMakeRect(730, 10, 130, TouchHeight), YES);
    [view addSubview:_replyButton];
    [self updateCommentButtons];
    return [self tabItem:@"review" view:view];
}

- (NSTabViewItem*)publishTab {
    NSView* view = Card(NSMakeRect(0, 0, 880, 484));
    [view addSubview:Label(@"Send en ny miks til Sound Room", NSMakeRect(24, 438, 500, 28), 18, YES)];
    [view addSubview:Label(@"Vi tar snapshot, eksporterer, kvalitetssjekker og laster opp. Du kan fortsette å jobbe mens dette skjer.", NSMakeRect(24, 398, 830, 38), 12, NO)];
    [view addSubview:Label(@"Navn på miksen", NSMakeRect(24, 360, 240, 20), 11, YES)];
    _reviewName = Field(@"For eksempel: Artist – Låt – Mix V8.wav", NSMakeRect(24, 318, 500, 36));
    _reviewName.stringValue = @"CreatorHub Review.wav";
    [view addSubview:_reviewName];
    [view addSubview:Label(@"Hva skal eksporteres?", NSMakeRect(544, 360, 280, 20), 11, YES)];
    _reviewSource = [[[NSPopUpButton alloc] initWithFrame:NSMakeRect(544, 318, 310, 36) pullsDown:NO] autorelease];
    [_reviewSource addItemWithTitle:@"Henter utganger …"];
    _reviewSource.accessibilityLabel = @"Velg masterbuss eller utgang";
    [view addSubview:_reviewSource];
    _sendButton = Button(@"Send miksen", self, @selector(sendReview:), NSMakeRect(24, 250, 180, 48), YES);
    [view addSubview:_sendButton];
    _forceButton = Button(@"Lag ny versjon likevel", self, @selector(forceReview:), NSMakeRect(214, 250, 210, 48), NO);
    _forceButton.hidden = YES;
    [view addSubview:_forceButton];
    _qcSummary = Label(@"Kvalitetssjekken vises her etter eksport.", NSMakeRect(24, 172, 830, 58), 13, YES);
    _qcSummary.maximumNumberOfLines = 3;
    _qcSummary.lineBreakMode = NSLineBreakByWordWrapping;
    [view addSubview:_qcSummary];
    NSView* info = Card(NSMakeRect(24, 24, 830, 124));
    [info addSubview:Label(@"Trygt og lydtransparent", NSMakeRect(16, 84, 320, 24), 14, YES)];
    NSTextField* explanation = Label(@"Pluginen endrer aldri lyden. Live-måleren viser signalet som passerer. Endelig LUFS og true peak måles på den eksporterte WAV-filen.", NSMakeRect(16, 28, 798, 52), 12, NO);
    explanation.maximumNumberOfLines = 3;
    explanation.lineBreakMode = NSLineBreakByWordWrapping;
    [info addSubview:explanation];
    [view addSubview:info];
    return [self tabItem:@"publish" view:view];
}

- (NSTabViewItem*)versionsTab {
    NSView* view = Card(NSMakeRect(0, 0, 880, 484));
    [view addSubview:Label(@"Sammenlign mikser", NSMakeRect(20, 446, 300, 24), 16, YES)];
    [view addSubview:Label(@"Velg én eller to versjoner. Vi legger dem inn som nye referansespor.", NSMakeRect(20, 414, 410, 24), 12, NO)];
    _versionTable = Table(@"versions", @"Versjoner", self, NSMakeRect(16, 208, 420, 198), view);
    _versionTable.allowsMultipleSelection = YES;
    _versionTable.accessibilityLabel = @"Sound Room-versjoner";
    _compareButton = Button(@"Legg inn som referanse", self, @selector(importVersions:), NSMakeRect(20, 154, 210, TouchHeight), YES);
    [view addSubview:_compareButton];

    [view addSubview:Label(@"Gå tilbake til en tidligere arbeidsstilling", NSMakeRect(458, 446, 400, 24), 16, YES)];
    [view addSubview:Label(@"Et recovery-snapshot tas alltid før noe endres.", NSMakeRect(458, 414, 400, 24), 12, NO)];
    _snapshotTable = Table(@"snapshots", @"Snapshots", self, NSMakeRect(446, 208, 418, 198), view);
    _snapshotTable.accessibilityLabel = @"Lagrede Pro Tools-snapshots";
    _recallButton = Button(@"Forhåndsvis og gjenopprett", self, @selector(previewRecall:), NSMakeRect(458, 154, 232, TouchHeight), YES);
    [view addSubview:_recallButton];

    NSView* safety = Card(NSMakeRect(20, 24, 840, 106));
    [safety addSubview:Label(@"Du kan angre", NSMakeRect(16, 66, 240, 24), 14, YES)];
    NSTextField* text = Label(@"CreatorHub viser hva som vil endres før recall. Manglende spor hoppes over, og gjeldende sesjon sikres automatisk først.", NSMakeRect(16, 18, 808, 46), 12, NO);
    text.maximumNumberOfLines = 2; text.lineBreakMode = NSLineBreakByWordWrapping;
    [safety addSubview:text]; [view addSubview:safety];
    [self updateVersionButtons];
    return [self tabItem:@"versions" view:view];
}

- (NSTabViewItem*)deliveryTab {
    NSView* view = Card(NSMakeRect(0, 0, 880, 484));
    [view addSubview:Label(@"Lag ferdige leveranser", NSMakeRect(20, 446, 350, 24), 16, YES)];
    [view addSubview:Label(@"Velg akkurat hvilken buss hver fil skal komme fra. CreatorHub gjetter aldri.", NSMakeRect(20, 416, 830, 22), 12, NO)];
    _deliveryPreset = [[[NSPopUpButton alloc] initWithFrame:NSMakeRect(20, 370, 170, 34) pullsDown:NO] autorelease];
    [_deliveryPreset addItemsWithTitles:@[@"Label", @"Film / sync", @"Stems", @"Egendefinert"]];
    _deliveryPreset.accessibilityLabel = @"Leveranseprofil";
    _deliveryPreset.target = self;
    _deliveryPreset.action = @selector(deliveryPresetChanged:);
    [view addSubview:_deliveryPreset];
    _deliveryFolder = Field(@"Velg leveransemappe", NSMakeRect(202, 370, 478, 34));
    _deliveryFolder.accessibilityLabel = @"Leveransemappe";
    [view addSubview:_deliveryFolder];
    [view addSubview:Button(@"Velg mappe", self, @selector(chooseDeliveryFolder:), NSMakeRect(690, 364, 166, TouchHeight), NO)];

    NSArray* kinds = @[@"Master", @"Instrumental", @"Acapella", @"Clean", @"TV-miks"];
    for (NSInteger index = 0; index < (NSInteger)kinds.count; ++index) {
        const CGFloat y = 318 - index * 48;
        NSButton* check = [[[NSButton alloc] initWithFrame:NSMakeRect(24, y, 154, 34)] autorelease];
        check.buttonType = NSButtonTypeSwitch;
        check.title = kinds[index];
        check.state = index == 0 ? NSControlStateValueOn : NSControlStateValueOff;
        check.accessibilityLabel = [NSString stringWithFormat:@"Ta med %@", kinds[index]];
        [view addSubview:check]; [_deliveryChecks addObject:check];
        NSPopUpButton* source = [[[NSPopUpButton alloc] initWithFrame:NSMakeRect(190, y, 420, 34) pullsDown:NO] autorelease];
        [source addItemWithTitle:@"Velg eksplisitt buss eller utgang"];
        source.accessibilityLabel = [NSString stringWithFormat:@"Kilde for %@", kinds[index]];
        [view addSubview:source]; [_deliverySources addObject:source];
    }
    _deliveryButton = Button(@"Kjør kvalitetssikret leveranse", self, @selector(runDelivery:), NSMakeRect(624, 270, 232, 52), YES);
    [view addSubview:_deliveryButton];
    [view addSubview:Label(@"Siste jobber", NSMakeRect(624, 232, 210, 22), 12, YES)];
    _jobTable = Table(@"jobs", @"Leveransejobber", self, NSMakeRect(616, 28, 248, 198), view);
    _jobTable.rowHeight = 42;
    return [self tabItem:@"delivery" view:view];
}

- (NSTabViewItem*)helpTab {
    NSView* view = Card(NSMakeRect(0, 0, 880, 484));
    [view addSubview:Label(@"Sjekk at alt virker", NSMakeRect(24, 440, 360, 28), 18, YES)];
    _diagnosticSummary = Label(@"Vi sjekker CreatorHub, Sound Room, EaseVerse, Pro Tools og den sikre køen.", NSMakeRect(24, 392, 830, 42), 13, NO);
    _diagnosticSummary.maximumNumberOfLines = 2;
    [view addSubview:_diagnosticSummary];
    [view addSubview:Button(@"Sjekk nå", self, @selector(runDiagnostics:), NSMakeRect(24, 328, 144, 48), YES)];
    [view addSubview:Button(@"Lag Intro-sikker kopi", self, @selector(makeIntroCopy:), NSMakeRect(180, 328, 210, 48), NO)];
    [view addSubview:Button(@"Vis tekniske detaljer", self, @selector(toggleTechnical:), NSMakeRect(402, 328, 200, 48), NO)];
    _diagnosticChecklist = Label(@"• Workspace-konto\n• Pro Tools\n• Sound Room\n• EaseVerse\n• Eksportmappe og kø", NSMakeRect(24, 174, 560, 132), 13, NO);
    _diagnosticChecklist.maximumNumberOfLines = 6;
    _diagnosticChecklist.lineBreakMode = NSLineBreakByWordWrapping;
    [view addSubview:_diagnosticChecklist];
    _technicalScroll = [[[NSScrollView alloc] initWithFrame:NSMakeRect(24, 24, 832, 284)] autorelease];
    _technicalScroll.hasVerticalScroller = YES;
    _technicalScroll.hidden = YES;
    _technicalText = [[[NSTextView alloc] initWithFrame:_technicalScroll.bounds] autorelease];
    _technicalText.editable = NO;
    _technicalText.selectable = YES;
    _technicalText.font = [NSFont monospacedSystemFontOfSize:11 weight:NSFontWeightRegular];
    _technicalScroll.documentView = _technicalText;
    [view addSubview:_technicalScroll];
    return [self tabItem:@"help" view:view];
}

- (void)replaceArray:(NSArray**)target value:(id)value {
    NSArray* next = [Array(value) copy];
    [*target release];
    *target = next;
}

- (void)beginBootstrap {
    _bootstrapStep = 1;
    [self runAction:@"state" payload:@{}];
}

- (void)advanceBootstrapAfter:(NSString*)action {
    if (_bootstrapStep == 1 && [action isEqualToString:@"state"]) { _bootstrapStep = 2; [self runAction:@"feedback" payload:@{}]; return; }
    if (_bootstrapStep == 2 && [action isEqualToString:@"feedback"]) { _bootstrapStep = 3; [self runAction:@"sources" payload:@{}]; return; }
    if (_bootstrapStep == 3 && [action isEqualToString:@"sources"]) { _bootstrapStep = 4; [self runAction:@"snapshots" payload:@{}]; return; }
    if (_bootstrapStep == 4 && [action isEqualToString:@"snapshots"]) { _bootstrapStep = 5; [self runAction:@"delivery_jobs" payload:@{}]; return; }
    if (_bootstrapStep == 5 && [action isEqualToString:@"delivery_jobs"]) { _bootstrapStep = 6; [self runAction:@"diagnostics" payload:@{}]; return; }
    if (_bootstrapStep == 6 && [action isEqualToString:@"diagnostics"]) {
        _bootstrapStep = 0;
        _globalMessage.stringValue = @"Alt er klart. Velg det du vil gjøre.";
    }
}

- (void)runAction:(NSString*)action payload:(NSDictionary*)payload {
    if (_requestInFlight) return;
    _requestInFlight = YES;
    [_activeAction release];
    _activeAction = [action copy];
    _globalMessage.stringValue = [self workingMessage:action];
    NSString* actionCopy = [action copy];
    NSString* payloadCopy = [JSONPayload(payload) copy];
    [self retain];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSDictionary* responseObject = nil;
        NSString* failure = nil;
        try {
            const std::string secret = creatorhub::aax::ReadLocalIpcSecretFromKeychain();
            creatorhub::CreatorHubReviewBridge bridge(secret);
            const std::string response = bridge.Send(
                RequestId(), std::string(actionCopy.UTF8String), std::string(payloadCopy.UTF8String));
            NSData* data = [NSData dataWithBytes:response.data() length:response.size()];
            id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
            if ([parsed isKindOfClass:[NSDictionary class]]) responseObject = [parsed retain];
            else failure = [@"Ugyldig svar fra Companion." retain];
        } catch (const std::exception& error) {
            failure = [[[NSString alloc] initWithUTF8String:error.what()] retain];
        } catch (...) {
            failure = [@"Ukjent feil i CreatorHub Review Console." retain];
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            self->_requestInFlight = NO;
            BOOL ok = [responseObject[@"ok"] boolValue];
            if (ok) {
                id result = responseObject[@"result"] ?: @{};
                [self applyResult:result action:actionCopy];
                self->_connectionStatus.stringValue = @"● Tilkoblet CreatorHub";
                self->_connectionStatus.textColor = Green();
                [self advanceBootstrapAfter:actionCopy];
            } else {
                NSString* error = failure ?: Text(responseObject[@"error"], @"Handlingen kunne ikke fullføres.");
                self->_globalMessage.stringValue = FriendlyError(error);
                self->_connectionStatus.stringValue = @"● Trenger hjelp";
                self->_connectionStatus.textColor = Orange();
                self->_bootstrapStep = 0;
            }
            [self updateEnabledState];
            [responseObject release];
            [failure release];
            [actionCopy release];
            [payloadCopy release];
            [self release];
        });
    });
}

- (NSString*)workingMessage:(NSString*)action {
    if ([action isEqualToString:@"send_review"]) return @"Eksporterer og kvalitetssjekker miksen …";
    if ([action isEqualToString:@"delivery"]) return @"Lager leveransene og kontrollerer hver fil …";
    if ([action isEqualToString:@"prepare_compare"] || [action isEqualToString:@"import_reference"]) return @"Henter referanselyden og legger den inn i Pro Tools …";
    if ([action isEqualToString:@"recall"]) return @"Sikrer nåværende sesjon og gjenoppretter snapshotet …";
    return @"Jobber …";
}

- (void)applyResult:(id)result action:(NSString*)action {
    if ([action isEqualToString:@"state"]) {
        NSDictionary* state = Dictionary(result);
        NSString* session = Text(state[@"sessionName"], @"Gjør ferdig miksen");
        _projectTitle.stringValue = session;
        if ([_reviewName.stringValue isEqualToString:@"CreatorHub Review.wav"]) {
            _reviewName.stringValue = [NSString stringWithFormat:@"%@ Review.wav", SafeBaseName(session)];
        }
        _versionTitle.stringValue = [state[@"paired"] boolValue]
            ? @"Koblet til Sound Room og CreatorHub Workspace"
            : @"Koble Companion til Workspace for å fortsette";
    } else if ([action isEqualToString:@"feedback"]) {
        NSDictionary* inbox = Dictionary(result);
        [self replaceArray:&_comments value:inbox[@"comments"]];
        [self replaceArray:&_versions value:inbox[@"versions"]];
        [_commentTable reloadData]; [_versionTable reloadData];
        NSDictionary* project = Dictionary(inbox[@"project"]);
        NSDictionary* version = Dictionary(inbox[@"version"]);
        if (Text(project[@"title"]).length) _projectTitle.stringValue = Text(project[@"title"]);
        _versionTitle.stringValue = Text(version[@"version_label"], @"Ingen miks er sendt ennå");
        NSUInteger open = 0;
        for (NSDictionary* comment in _comments) if (![Text(comment[@"status"]) isEqualToString:@"resolved"]) ++open;
        NSDictionary* brief = Dictionary(inbox[@"brief"]);
        NSArray* tasks = Array(inbox[@"tasks"]);
        NSUInteger todo = 0;
        for (NSDictionary* task in tasks) if (![Text(task[@"status"]) isEqualToString:@"done"]) ++todo;
        NSString* summary = Text(brief[@"summary"]);
        NSMutableArray* music = [NSMutableArray array];
        if ([project[@"bpm"] respondsToSelector:@selector(integerValue)] && [project[@"bpm"] integerValue] > 0) {
            [music addObject:[NSString stringWithFormat:@"%ld BPM", (long)[project[@"bpm"] integerValue]]];
        }
        if (Text(project[@"musical_key"]).length) [music addObject:Text(project[@"musical_key"])];
        if (Text(project[@"genre"]).length) [music addObject:Text(project[@"genre"])];
        NSMutableArray* structure = [NSMutableArray array];
        for (NSDictionary* section in Array(inbox[@"sections"])) {
            if (![Text(section[@"version_id"]) isEqualToString:Text(version[@"id"])]) continue;
            NSString* name = Text(section[@"name"]);
            if (name.length && ![structure containsObject:name]) [structure addObject:name];
            if (structure.count == 6) break;
        }
        NSMutableString* overview = [NSMutableString stringWithFormat:@"%lu åpne kommentarer · %lu oppgaver", (unsigned long)open, (unsigned long)todo];
        if (music.count) [overview appendFormat:@" · %@", [music componentsJoinedByString:@" · "]];
        if (structure.count) [overview appendFormat:@"\nLåtstruktur: %@", [structure componentsJoinedByString:@" → "]];
        if (summary.length) [overview appendFormat:@"\nMålet: %@", summary];
        else if (!structure.count) [overview appendString:@"\nVelg en kommentar under, så finner vi riktig sted i Pro Tools."];
        _reviewSummary.stringValue = overview;
        if ([inbox[@"offline"] boolValue]) {
            _connectionStatus.stringValue = @"● Offline – viser sist lagret";
            _connectionStatus.textColor = Orange();
        }
    } else if ([action isEqualToString:@"sources"]) {
        [self replaceArray:&_sources value:Dictionary(result)[@"sources"]];
        [self populateSourceMenus];
    } else if ([action isEqualToString:@"snapshots"]) {
        [self replaceArray:&_snapshots value:result];
        [_snapshotTable reloadData];
    } else if ([action isEqualToString:@"delivery_jobs"]) {
        [self replaceArray:&_jobs value:result];
        [_jobTable reloadData];
    } else if ([action isEqualToString:@"send_review"]) {
        NSDictionary* review = Dictionary(result);
        NSDictionary* qc = Dictionary(review[@"qc_report"]);
        BOOL passed = [qc[@"passed"] boolValue];
        _qcSummary.textColor = passed ? Green() : Orange();
        _qcSummary.stringValue = [NSString stringWithFormat:@"%@ · %@ LUFS-I · %@ dBTP · %@ Hz / %@-bit%@",
            passed ? @"Kvalitetssjekk bestått" : @"Kontroller avvikene før levering",
            qc[@"integrated_lufs"] ?: @"—", qc[@"true_peak_dbtp"] ?: @"—",
            qc[@"sample_rate"] ?: @"—", qc[@"bit_depth"] ?: @"—",
            [review[@"version_number"] respondsToSelector:@selector(stringValue)]
                ? [NSString stringWithFormat:@" · Mix V%@", [review[@"version_number"] stringValue]] : @""];
        _forceButton.hidden = ![review[@"idempotent"] boolValue];
        _globalMessage.stringValue = [review[@"idempotent"] boolValue]
            ? @"Denne lyden finnes allerede. Ingen kopi ble laget."
            : @"Miksen er klar i Sound Room.";
        [self runAction:@"feedback" payload:@{}];
    } else if ([action isEqualToString:@"snapshot"]) {
        _globalMessage.stringValue = @"Snapshotet er lagret trygt.";
        [self runAction:@"snapshots" payload:@{}];
    } else if ([action isEqualToString:@"recall_preview"]) {
        NSDictionary* preview = Dictionary(result);
        NSInteger changed = 0;
        for (NSDictionary* change in Array(preview[@"changes"])) changed += [change[@"trackCount"] integerValue];
        NSAlert* alert = [[[NSAlert alloc] init] autorelease];
        alert.messageText = changed ? [NSString stringWithFormat:@"Gjenopprett %ld sporendringer?", (long)changed] : @"Sesjonen matcher allerede snapshotet";
        alert.informativeText = changed ? @"CreatorHub tar først et recovery-snapshot. Manglende spor hoppes trygt over." : @"Ingenting trenger å endres.";
        [alert addButtonWithTitle:changed ? @"Gjenopprett trygt" : @"OK"];
        if (changed) [alert addButtonWithTitle:@"Avbryt"];
        if ([alert runModal] == NSAlertFirstButtonReturn && changed && _pendingSnapshotId.length) {
            [self runAction:@"recall" payload:@{ @"snapshotId": _pendingSnapshotId }];
        }
    } else if ([action isEqualToString:@"recall"]) {
        _globalMessage.stringValue = @"Snapshotet er gjenopprettet. Recovery-kopien er lagret.";
        [self runAction:@"snapshots" payload:@{}];
    } else if ([action isEqualToString:@"import_reference"] || [action isEqualToString:@"prepare_compare"]) {
        _globalMessage.stringValue = @"Referanselyden er lagt inn på nye spor i Pro Tools.";
    } else if ([action isEqualToString:@"delivery"]) {
        NSDictionary* delivery = Dictionary(result);
        _globalMessage.stringValue = [NSString stringWithFormat:@"Ferdig: %lu filer er kvalitetssikret og samlet i leveransen.", (unsigned long)Array(delivery[@"outputs"]).count];
        [self runAction:@"delivery_jobs" payload:@{}];
    } else if ([action isEqualToString:@"diagnostics"]) {
        NSDictionary* info = Dictionary(result);
        _technicalText.string = PrettyJSON(info);
        if ([info[@"ready"] boolValue]) {
            _diagnosticSummary.stringValue = @"Alt viktig er klart. CreatorHub, Sound Room og Pro Tools snakker sammen.";
            _diagnosticSummary.textColor = Green();
        } else {
            NSMutableArray* needs = [NSMutableArray array];
            if (![info[@"paired"] boolValue]) [needs addObject:@"koble til Workspace"];
            if (![info[@"sessionReady"] boolValue]) [needs addObject:@"velg sesjon"];
            if (![info[@"soundRoomReady"] boolValue]) [needs addObject:@"velg Sound Room"];
            if (![Dictionary(info[@"ptsl"])[@"state"] isEqual:@"connected"]) [needs addObject:@"start Pro Tools"];
            _diagnosticSummary.stringValue = [NSString stringWithFormat:@"Gjør dette først: %@.", [needs componentsJoinedByString:@", "]];
            _diagnosticSummary.textColor = Orange();
        }
        BOOL ptslReady = [Dictionary(info[@"ptsl"])[@"state"] isEqual:@"connected"];
        _diagnosticChecklist.stringValue = [NSString stringWithFormat:
            @"%@ Workspace-konto\n%@ Pro Tools\n%@ Sound Room\n%@ EaseVerse\n%@ Eksportmappe\n%@ Opplastingskø",
            [info[@"paired"] boolValue] ? @"✓" : @"•",
            ptslReady ? @"✓" : @"•",
            [info[@"soundRoomReady"] boolValue] ? @"✓" : @"•",
            [info[@"easeVerseReady"] boolValue] ? @"✓" : @"•",
            [info[@"bounceFolderReady"] boolValue] ? @"✓" : @"•",
            [info[@"pendingUploads"] integerValue] == 0 ? @"✓" : @"•"];
    } else if ([action isEqualToString:@"intro_copy"]) {
        _globalMessage.stringValue = @"Intro-sikker kopi er opprettet. Originalen er ikke endret.";
    } else if ([action isEqualToString:@"locate"]) {
        _globalMessage.stringValue = @"Avspillingshodet er flyttet til kommentaren.";
    } else if ([action isEqualToString:@"mark"]) {
        _globalMessage.stringValue = @"Kommentaren er lagt inn som markør i Pro Tools.";
    } else if ([action isEqualToString:@"resolve"]) {
        _globalMessage.stringValue = @"Kommentaren er markert som løst.";
        [self runAction:@"feedback" payload:@{}];
    } else if ([action isEqualToString:@"reply"]) {
        _replyField.stringValue = @"";
        _globalMessage.stringValue = @"Svaret er sendt til Sound Room.";
        [self runAction:@"feedback" payload:@{}];
    }
}

- (void)populateSourceMenus {
    NSMutableArray* titles = [NSMutableArray array];
    for (NSDictionary* source in _sources) {
        NSString* name = Text(source[@"name"]);
        if (name.length) [titles addObject:name];
    }
    [_reviewSource removeAllItems];
    if (titles.count) [_reviewSource addItemsWithTitles:titles];
    else [_reviewSource addItemWithTitle:@"Ingen buss eller utgang funnet"];
    NSArray* patterns = @[@"master|main|mix|out 1-2", @"instrumental|inst", @"acapella|a cappella|vocal", @"clean", @"tv|music.*effects|m&e"];
    for (NSInteger menuIndex = 0; menuIndex < (NSInteger)_deliverySources.count; ++menuIndex) {
        NSPopUpButton* menu = _deliverySources[menuIndex];
        [menu removeAllItems];
        [menu addItemWithTitle:@"Velg eksplisitt buss eller utgang"];
        [menu addItemsWithTitles:titles];
        NSRegularExpression* expression = [NSRegularExpression regularExpressionWithPattern:patterns[menuIndex] options:NSRegularExpressionCaseInsensitive error:nil];
        for (NSString* title in titles) {
            if ([expression firstMatchInString:title options:0 range:NSMakeRange(0, title.length)]) {
                [menu selectItemWithTitle:title];
                break;
            }
        }
    }
    _sendButton.enabled = titles.count > 0;
}

- (void)timerTick:(NSTimer*)timer {
    (void)timer;
    const auto signal = creatorhub::aax::ReadLiveSignal();
    NSString* phase = signal.stereoCorrelation < -0.2F ? @" · sjekk fase" : @" · stereo OK";
    _signalStatus.stringValue = signal.sequence
        ? [NSString stringWithFormat:@"Signal: peak %@ · RMS %@%@", Decibels(signal.peakLinear), Decibels(signal.rmsLinear), phase]
        : @"Signal: start avspilling for live-kontroll";
    _signalStatus.textColor = signal.peakLinear >= 0.999F ? Orange() : Muted();
    if (++_pollTicks >= 24) {
        _pollTicks = 0;
        if (!_requestInFlight && _bootstrapStep == 0) [self runAction:@"feedback" payload:@{}];
    }
}

- (void)sectionChanged:(id)sender { (void)sender; [_tabs selectTabViewItemAtIndex:_sections.selectedSegment]; }

- (NSDictionary*)selectedComment {
    NSInteger row = _commentTable.selectedRow;
    return row >= 0 && row < (NSInteger)_comments.count ? _comments[row] : nil;
}

- (NSDictionary*)selectedSnapshot {
    NSInteger row = _snapshotTable.selectedRow;
    return row >= 0 && row < (NSInteger)_snapshots.count ? _snapshots[row] : nil;
}

- (void)nextComment:(id)sender {
    (void)sender;
    for (NSInteger index = 0; index < (NSInteger)_comments.count; ++index) {
        NSDictionary* comment = _comments[index];
        if (![Text(comment[@"status"]) isEqualToString:@"resolved"]) {
            [_commentTable selectRowIndexes:[NSIndexSet indexSetWithIndex:index] byExtendingSelection:NO];
            [_commentTable scrollRowToVisible:index];
            [self locateComment:nil];
            return;
        }
    }
    _globalMessage.stringValue = @"Alt er løst. Bra jobbet!";
}

- (void)locateComment:(id)sender { (void)sender; NSDictionary* c = [self selectedComment]; if (c) [self runAction:@"locate" payload:@{ @"seconds": c[@"timecode_seconds"] ?: @0 }]; }
- (void)markComment:(id)sender {
    (void)sender; NSDictionary* c = [self selectedComment]; if (!c) return;
    NSString* body = Text(c[@"body"], @"Sound Room feedback");
    if (body.length > 120) body = [body substringToIndex:120];
    [self runAction:@"mark" payload:@{ @"commentId": Text(c[@"id"]), @"seconds": c[@"timecode_seconds"] ?: @0, @"name": body, @"category": Text(c[@"category"], @"general") }];
}
- (void)resolveComment:(id)sender { (void)sender; NSDictionary* c = [self selectedComment]; if (c) [self runAction:@"resolve" payload:@{ @"commentId": Text(c[@"id"]) }]; }
- (void)replyComment:(id)sender {
    (void)sender; NSDictionary* c = [self selectedComment]; NSString* body = [_replyField.stringValue stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (!c || !body.length) { _globalMessage.stringValue = @"Velg en kommentar og skriv et svar først."; return; }
    [self runAction:@"reply" payload:@{ @"commentId": Text(c[@"id"]), @"body": body }];
}

- (void)sendReview:(id)sender { (void)sender; [self sendReviewForce:NO]; }
- (void)forceReview:(id)sender { (void)sender; [self sendReviewForce:YES]; }
- (void)sendReviewForce:(BOOL)force {
    NSString* name = [_reviewName.stringValue stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (!name.length) { _globalMessage.stringValue = @"Skriv et navn på miksen først."; return; }
    [self runAction:@"send_review" payload:@{ @"fileName": name, @"source": _reviewSource.titleOfSelectedItem ?: @"", @"forceNewVersion": @(force) }];
}

- (void)importVersions:(id)sender {
    (void)sender;
    NSMutableArray* references = [NSMutableArray array];
    [_versionTable.selectedRowIndexes enumerateIndexesUsingBlock:^(NSUInteger index, BOOL* stop) {
        if (references.count >= 2) { *stop = YES; return; }
        NSDictionary* version = self->_versions[index];
        NSString* artifact = Text(version[@"artifact_id"]);
        if (artifact.length) [references addObject:@{ @"artifactId": artifact, @"fileName": [NSString stringWithFormat:@"%@ Reference.wav", Text(version[@"version_label"], @"Mix")] }];
    }];
    if (!references.count) { _globalMessage.stringValue = @"Velg en versjon som har en tilgjengelig CreatorHub-lydfil."; return; }
    if (references.count == 1) [self runAction:@"import_reference" payload:references[0]];
    else [self runAction:@"prepare_compare" payload:@{ @"references": references }];
}

- (void)previewRecall:(id)sender {
    (void)sender; NSDictionary* snapshot = [self selectedSnapshot]; NSString* identifier = Text(snapshot[@"id"]);
    if (!identifier.length) { _globalMessage.stringValue = @"Velg et snapshot først."; return; }
    [_pendingSnapshotId release]; _pendingSnapshotId = [identifier copy];
    [self runAction:@"recall_preview" payload:@{ @"snapshotId": identifier }];
}

- (void)chooseDeliveryFolder:(id)sender {
    (void)sender; NSOpenPanel* panel = [NSOpenPanel openPanel]; panel.canChooseDirectories = YES; panel.canChooseFiles = NO; panel.allowsMultipleSelection = NO;
    panel.prompt = @"Velg mappe"; panel.message = @"Her lagres de ferdige leveransefilene.";
    if ([panel runModal] == NSModalResponseOK) _deliveryFolder.stringValue = panel.URL.path ?: @"";
}

- (void)deliveryPresetChanged:(id)sender {
    (void)sender;
    BOOL stems = _deliveryPreset.indexOfSelectedItem == 2;
    for (NSButton* check in _deliveryChecks) check.enabled = !stems;
    for (NSPopUpButton* source in _deliverySources) source.enabled = !stems;
    _globalMessage.stringValue = stems
        ? @"Stems bruker alle oppdagede busser og utganger som separate filer."
        : @"Velg filene du trenger og en tydelig kilde for hver.";
}

- (void)runDelivery:(id)sender {
    (void)sender;
    NSString* folder = [_deliveryFolder.stringValue stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
    if (!folder.length) { _globalMessage.stringValue = @"Velg leveransemappe først."; return; }
    NSArray* kinds = @[@"master", @"instrumental", @"acapella", @"clean", @"tv"];
    NSArray* suffixes = @[@"MASTER", @"INSTRUMENTAL", @"ACAPELLA", @"CLEAN", @"TV"];
    NSMutableArray* outputs = [NSMutableArray array];
    NSString* base = SafeBaseName(_projectTitle.stringValue);
    if (_deliveryPreset.indexOfSelectedItem == 2) {
        for (NSDictionary* source in _sources) {
            NSString* name = Text(source[@"name"]);
            if (name.length) [outputs addObject:@{
                @"kind": @"stem",
                @"fileName": [NSString stringWithFormat:@"%@ STEM %@.wav", base, SafeBaseName(name)],
                @"source": name,
            }];
        }
    }
    for (NSInteger index = 0; _deliveryPreset.indexOfSelectedItem != 2 && index < 5; ++index) {
        NSButton* check = _deliveryChecks[index];
        if (check.state != NSControlStateValueOn) continue;
        NSPopUpButton* source = _deliverySources[index];
        if (!_sources.count || source.indexOfSelectedItem <= 0) {
            _globalMessage.stringValue = [NSString stringWithFormat:@"Velg en tydelig kilde for %@.", check.title];
            return;
        }
        [outputs addObject:@{ @"kind": kinds[index], @"fileName": [NSString stringWithFormat:@"%@ %@.wav", base, suffixes[index]], @"source": source.titleOfSelectedItem }];
    }
    if (!outputs.count) { _globalMessage.stringValue = @"Velg minst én fil og en tydelig eksportkilde."; return; }
    NSArray* presetValues = @[@"label", @"sync", @"stems", @"custom"];
    [self runAction:@"delivery" payload:@{ @"preset": presetValues[_deliveryPreset.indexOfSelectedItem], @"outputDirectory": folder, @"outputs": outputs }];
}

- (void)runDiagnostics:(id)sender { (void)sender; [self runAction:@"diagnostics" payload:@{}]; }
- (void)toggleTechnical:(id)sender { (void)sender; _technicalScroll.hidden = !_technicalScroll.hidden; }
- (void)makeIntroCopy:(id)sender {
    (void)sender; NSOpenPanel* panel = [NSOpenPanel openPanel]; panel.canChooseDirectories = YES; panel.canChooseFiles = NO; panel.prompt = @"Lag sikker kopi";
    panel.message = @"Originalsesjonen blir ikke endret.";
    if ([panel runModal] == NSModalResponseOK) [self runAction:@"intro_copy" payload:@{ @"outputDirectory": panel.URL.path ?: @"", @"sessionName": [NSString stringWithFormat:@"%@ – Intro Safe", SafeBaseName(_projectTitle.stringValue)] }];
}

- (NSInteger)numberOfRowsInTableView:(NSTableView*)tableView {
    if ([tableView.identifier isEqualToString:@"comments"]) return _comments.count;
    if ([tableView.identifier isEqualToString:@"versions"]) return _versions.count;
    if ([tableView.identifier isEqualToString:@"snapshots"]) return _snapshots.count;
    if ([tableView.identifier isEqualToString:@"jobs"]) return std::min<NSUInteger>(_jobs.count, 6);
    return 0;
}

- (NSView*)tableView:(NSTableView*)tableView viewForTableColumn:(NSTableColumn*)tableColumn row:(NSInteger)row {
    (void)tableColumn;
    NSTextField* label = [tableView makeViewWithIdentifier:@"row" owner:self];
    if (!label) { label = Label(@"", NSMakeRect(0, 0, 100, tableView.rowHeight), 12, NO); label.identifier = @"row"; }
    label.maximumNumberOfLines = 2; label.lineBreakMode = NSLineBreakByTruncatingTail;
    if ([tableView.identifier isEqualToString:@"comments"]) {
        NSDictionary* c = _comments[row];
        BOOL resolved = [Text(c[@"status"]) isEqualToString:@"resolved"];
        label.stringValue = [NSString stringWithFormat:@"%@   %@\n%@%@", Timecode(c[@"timecode_seconds"]), Text(c[@"body"], @"Kommentar"), Text(c[@"author"], @"Sound Room"), resolved ? @" · Løst" : @""];
        label.textColor = resolved ? Muted() : [NSColor labelColor];
        label.accessibilityLabel = label.stringValue;
    } else if ([tableView.identifier isEqualToString:@"versions"]) {
        NSDictionary* v = _versions[row];
        NSString* available = Text(v[@"artifact_id"]).length ? @"Referanse klar" : @"Ingen Companion-fil";
        label.stringValue = [NSString stringWithFormat:@"%@ · %@\n%@ · %@ åpne kommentarer", Text(v[@"version_label"], @"Miks"), StatusLabel(Text(v[@"status"])), available, v[@"open_comment_count"] ?: @0];
    } else if ([tableView.identifier isEqualToString:@"snapshots"]) {
        NSDictionary* s = _snapshots[row];
        label.stringValue = [NSString stringWithFormat:@"%@\n%@ spor · %@ Hz · %@", Text(s[@"session_name"], @"Snapshot"), s[@"track_count"] ?: @0, s[@"sample_rate"] ?: @"?", SnapshotReason(Text(s[@"reason"]))];
    } else {
        NSDictionary* job = _jobs[row];
        NSDictionary* presetNames = @{ @"label": @"Label", @"sync": @"Film / sync", @"stems": @"Stems", @"custom": @"Egendefinert" };
        NSString* preset = presetNames[Text(job[@"preset"])] ?: @"Leveranse";
        label.stringValue = [NSString stringWithFormat:@"%@ · %@\n%@%% ferdig", preset, StatusLabel(Text(job[@"status"])), job[@"progress"] ?: @0];
    }
    return label;
}

- (void)tableViewSelectionDidChange:(NSNotification*)notification {
    (void)notification; [self updateCommentButtons]; [self updateVersionButtons];
}

- (void)updateCommentButtons {
    NSDictionary* comment = [self selectedComment];
    BOOL selected = comment != nil;
    BOOL open = selected && ![Text(comment[@"status"]) isEqualToString:@"resolved"];
    _locateButton.enabled = selected && !_requestInFlight;
    _markerButton.enabled = open && !_requestInFlight;
    _resolveButton.enabled = open && !_requestInFlight;
    _replyButton.enabled = selected && !_requestInFlight;
}

- (void)updateVersionButtons {
    _compareButton.enabled = _versionTable.selectedRowIndexes.count > 0 && !_requestInFlight;
    _recallButton.enabled = _snapshotTable.selectedRow >= 0 && !_requestInFlight;
}

- (void)updateEnabledState {
    [self updateCommentButtons]; [self updateVersionButtons];
    _sendButton.enabled = !_requestInFlight && _sources.count > 0;
    _deliveryButton.enabled = !_requestInFlight && _sources.count > 0;
}

@end

#if defined(CREATORHUB_AAX_UI_PREVIEW)

int main(int argc, const char* argv[]) {
    (void)argc; (void)argv;
    NSAutoreleasePool* pool = [[NSAutoreleasePool alloc] init];
    NSApplication* application = [NSApplication sharedApplication];
    application.activationPolicy = NSApplicationActivationPolicyRegular;
    CreatorHubReviewController* controller = [[CreatorHubReviewController alloc] init];
    NSWindow* window = [[NSWindow alloc]
        initWithContentRect:NSMakeRect(0, 0, ViewWidth, ViewHeight)
                  styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable
                    backing:NSBackingStoreBuffered
                      defer:NO];
    window.title = @"CreatorHub Review Console – UX Preview";
    window.contentViewController = controller;
    [window center];
    [window makeKeyAndOrderFront:nil];
    if (std::getenv("CREATORHUB_UI_SAMPLE_DATA")) {
        [controller applyResult:@{
            @"project": @{ @"title": @"Nordlys – ferdig miks", @"bpm": @124, @"musical_key": @"Dm", @"genre": @"Pop" },
            @"version": @{ @"id": @"v8", @"version_label": @"Mix V8" },
            @"versions": @[
                @{ @"id": @"v8", @"version_label": @"Mix V8", @"status": @"under_review", @"open_comment_count": @2, @"artifact_id": @"artifact-8" },
                @{ @"id": @"v7", @"version_label": @"Mix V7", @"status": @"approved", @"open_comment_count": @0, @"artifact_id": @"artifact-7" },
            ],
            @"comments": @[
                @{ @"id": @"c1", @"timecode_seconds": @18, @"body": @"Vokalen kan litt frem i første vers.", @"author": @"Maria", @"status": @"unresolved", @"category": @"mix" },
                @{ @"id": @"c2", @"timecode_seconds": @64, @"body": @"Koret sitter veldig bra. Behold denne følelsen.", @"author": @"Jonas", @"status": @"unresolved", @"category": @"performance" },
                @{ @"id": @"c3", @"timecode_seconds": @102, @"body": @"Løst: mindre romklang i outro.", @"author": @"Maria", @"status": @"resolved", @"category": @"mix" },
            ],
            @"tasks": @[ @{ @"status": @"todo" } ],
            @"sections": @[
                @{ @"version_id": @"v8", @"name": @"Intro" },
                @{ @"version_id": @"v8", @"name": @"Vers" },
                @{ @"version_id": @"v8", @"name": @"Refreng" },
            ],
            @"brief": @{ @"summary": @"Bevar nærheten i vokalen og energien i refrenget." },
        } action:@"feedback"];
        [controller applyResult:@{ @"sources": @[
            @{ @"name": @"MIX BUS", @"sourceType": @"EMSType_Bus" },
            @{ @"name": @"INSTRUMENTAL", @"sourceType": @"EMSType_Bus" },
        ] } action:@"sources"];
        [controller applyResult:@[
            @{ @"id": @"snapshot-8", @"session_name": @"Nordlys", @"track_count": @48, @"sample_rate": @48000, @"reason": @"pre_publish" },
            @{ @"id": @"snapshot-7", @"session_name": @"Nordlys", @"track_count": @46, @"sample_rate": @48000, @"reason": @"manual" },
        ] action:@"snapshots"];
        [controller applyResult:@[
            @{ @"preset": @"label", @"status": @"completed", @"progress": @100 },
            @{ @"preset": @"sync", @"status": @"running", @"progress": @64 },
        ] action:@"delivery_jobs"];
        [controller applyResult:@{
            @"ready": @YES, @"paired": @YES, @"sessionReady": @YES,
            @"soundRoomReady": @YES, @"easeVerseReady": @YES, @"bounceFolderReady": @YES,
            @"ptsl": @{ @"state": @"connected" }, @"pendingUploads": @0,
        } action:@"diagnostics"];
    }
    const char* tabValue = std::getenv("CREATORHUB_UI_TAB");
    if (tabValue && tabValue[0]) {
        NSInteger tab = std::clamp<NSInteger>(std::atoi(tabValue), 0, 4);
        NSSegmentedControl* sections = [controller valueForKey:@"sections"];
        sections.selectedSegment = tab;
        [controller sectionChanged:nil];
    }
    const char* snapshotPath = std::getenv("CREATORHUB_UI_SNAPSHOT");
    if (snapshotPath && snapshotPath[0]) {
        [controller.view layoutSubtreeIfNeeded];
        NSBitmapImageRep* image = [controller.view bitmapImageRepForCachingDisplayInRect:controller.view.bounds];
        [controller.view cacheDisplayInRect:controller.view.bounds toBitmapImageRep:image];
        NSData* png = [image representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
        [png writeToFile:[NSString stringWithUTF8String:snapshotPath] atomically:YES];
        [controller release];
        [window release];
        [pool drain];
        return png ? 0 : 2;
    }
    [application activateIgnoringOtherApps:YES];
    [application run];
    [controller release];
    [window release];
    [pool drain];
    return 0;
}

#else

namespace creatorhub::aax {

AAX_IEffectGUI* AAX_CALLBACK ReviewConsoleGUI::Create() {
    return new ReviewConsoleGUI();
}

void ReviewConsoleGUI::CreateViewContents() {
    SetViewController([[CreatorHubReviewController alloc] init]);
}

} // namespace creatorhub::aax

#endif
