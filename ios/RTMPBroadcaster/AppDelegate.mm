#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <AVFoundation/AVFoundation.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"RTMPBroadcaster";
  self.initialProps = @{};

  // ── AVAudioSession setup required by react-native-rtmp-publisher ──────────
  // HaishinKit (iOS RTMP library) needs PlayAndRecord + VoiceChat mode so the
  // microphone works correctly alongside the camera preview.
  AVAudioSession *audioSession = AVAudioSession.sharedInstance;
  NSError *audioError = nil;

  if (@available(iOS 10.0, *)) {
    [audioSession
      setCategory:AVAudioSessionCategoryPlayAndRecord
              mode:AVAudioSessionModeVoiceChat
           options:AVAudioSessionCategoryOptionDefaultToSpeaker |
                   AVAudioSessionCategoryOptionAllowBluetooth
             error:&audioError];
  } else {
    [audioSession
      setCategory:AVAudioSessionCategoryPlayAndRecord
             error:&audioError];
  }

  [audioSession setActive:YES error:&audioError];

  if (audioError) {
    NSLog(@"[RTMPBroadcaster] AVAudioSession configuration error: %@",
          audioError.localizedDescription);
  }
  // ─────────────────────────────────────────────────────────────────────────

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings]
      jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
