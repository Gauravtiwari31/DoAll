import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GoogleSignInSection } from '../components/GoogleSignInSection';
import { ServerButton } from '../components/ServerSettings';
import { PrioritySticker } from '../components/tasks/TaskBadges';
import {
  Accent,
  AppText,
  BrutalBox,
  Button,
  Icon,
  Logo,
  Screen,
} from '../components/ui';
import { AuthScreenProps } from '../navigation/types';
import { palette, useTheme } from '../theme';

/** A loose pile of example "notes" that previews what the app does. */
function NoteCollage() {
  const t = useTheme();
  return (
    <View
      style={styles.collage}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <BrutalBox
        color={palette.butter}
        style={[styles.note, styles.note1]}
        contentStyle={styles.noteFace}
      >
        <View style={[styles.miniCheck, { backgroundColor: palette.lime }]}>
          <Icon name="check" size={14} color={palette.ink} strokeWidth={3.4} />
        </View>
        <AppText variant="bodyStrong" color={palette.ink} style={styles.struck}>
          Buy oat milk
        </AppText>
      </BrutalBox>

      <BrutalBox
        color={palette.sky}
        style={[styles.note, styles.note2]}
        contentStyle={styles.noteFace}
      >
        <View style={[styles.miniCheck, { backgroundColor: palette.card }]} />
        <View>
          <AppText variant="bodyStrong" color={palette.ink}>
            Pitch deck v2
          </AppText>
          <AppText variant="mono" color={palette.danger}>
            Due in 3h
          </AppText>
        </View>
        <PrioritySticker priority="high" />
      </BrutalBox>

      <BrutalBox
        color={palette.blush}
        style={[styles.note, styles.note3]}
        contentStyle={styles.noteFace}
      >
        <View style={[styles.miniCheck, { backgroundColor: palette.card }]} />
        <View>
          <AppText variant="bodyStrong" color={palette.ink}>
            Gym session
          </AppText>
          <AppText variant="mono" color={palette.inkSoft}>
            Today · 7:00pm
          </AppText>
        </View>
      </BrutalBox>

      <View style={[styles.spark, { borderColor: t.colors.line }]}>
        <Icon name="sparkle" size={22} color={palette.ink} />
      </View>
    </View>
  );
}

export function WelcomeScreen({ navigation }: AuthScreenProps<'Welcome'>) {
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Logo size={34} />
          <ServerButton />
        </View>

        <View style={styles.hero}>
          <AppText variant="display" style={styles.headline}>
            Do it
          </AppText>
          <View style={styles.allRow}>
            <BrutalBox
              color={palette.lime}
              radius={16}
              style={styles.allSticker}
              contentStyle={styles.allFace}
            >
              <AppText color={palette.ink}>
                <Accent size={72} style={styles.allText}>
                  all.
                </Accent>
              </AppText>
            </BrutalBox>
          </View>
          <AppText variant="body" color="textMuted" style={styles.lede}>
            Plan your day, beat your deadlines, and let DoAll's smart sort tell
            you what to tackle next.
          </AppText>
        </View>

        <NoteCollage />

        <View style={styles.actions}>
          <Button
            title="Create an account"
            icon="arrowRight"
            onPress={() => navigation.navigate('Register')}
            testID="welcome-register"
          />
          <Button
            title="I already have an account"
            variant="outline"
            onPress={() => navigation.navigate('Login')}
            testID="welcome-login"
          />
          <GoogleSignInSection policyNote />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 24, paddingTop: 16 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  hero: { marginTop: 36 },
  headline: { fontSize: 64, lineHeight: 66, letterSpacing: -2.4 },
  allRow: { flexDirection: 'row', marginTop: 4 },
  allSticker: { transform: [{ rotate: '-3deg' }] },
  allFace: { paddingHorizontal: 18, paddingTop: 2, paddingBottom: 6 },
  allText: { lineHeight: 78 },
  lede: { marginTop: 22, maxWidth: 320, fontSize: 16, lineHeight: 23 },
  collage: { height: 220, marginTop: 28, marginBottom: 12 },
  note: { position: 'absolute' },
  note1: { top: 0, left: 0, transform: [{ rotate: '-6deg' }] },
  note2: { top: 64, right: 0, transform: [{ rotate: '4deg' }] },
  note3: { top: 140, left: 24, transform: [{ rotate: '-2deg' }] },
  noteFace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  miniCheck: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  struck: { textDecorationLine: 'line-through' },
  spark: {
    position: 'absolute',
    top: 8,
    right: 42,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: palette.lilac,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 12, marginTop: 'auto', paddingTop: 16 },
});
