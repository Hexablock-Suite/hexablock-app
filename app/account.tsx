import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Scenery } from '../src/infrastructure/ui/scenery';
import { column, palette, radius, serif, space } from '../src/infrastructure/ui/theme';
import { useAccount } from '../src/infrastructure/ui/use-account';
import { LipButton, WoodSign } from '../src/infrastructure/ui/wood';

// The account screen, the MVP view of `AccountPresenter` (#45, APP-FR-12, flows.md use case 5).
// The player types a username and a password, and signs up or signs in. While a request runs, the
// screen shows the busy text and takes no second press. A success shows the signed-in text, and
// a failure shows its text as an alert. The password field hides what the player types.
// The back button goes to the screen before, or home when the route opened first.
// Every visible text comes from the text catalog through the presenter (APP-FR-11).
export default function AccountScreen() {
  const { model, signUp, signIn } = useAccount();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const insets = useSafeAreaInsets();
  const busy = model.busy !== undefined;
  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <Scenery />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxl },
        ]}
      >
        <View style={styles.top}>
          <LipButton label={model.back} look="panel" onPress={goBack} />
        </View>
        <WoodSign style={styles.titleSign}>
          <Text accessibilityRole="header" style={styles.title}>
            {model.title}
          </Text>
        </WoodSign>
        <WoodSign style={styles.formSign}>
          <View style={styles.form}>
            <Text style={styles.label}>{model.username}</Text>
            <TextInput
              accessibilityLabel={model.username}
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              editable={!busy}
              onChangeText={setUsername}
              style={styles.field}
              textContentType="username"
              value={username}
            />
            <Text style={styles.label}>{model.password}</Text>
            <TextInput
              accessibilityLabel={model.password}
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              editable={!busy}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.field}
              textContentType="password"
              value={password}
            />
          </View>
        </WoodSign>
        <View style={styles.actions}>
          <LipButton
            label={model.signIn}
            look="sun"
            disabled={busy}
            onPress={() => signIn({ username, password })}
          />
          <LipButton
            label={model.signUp}
            look="panel"
            disabled={busy}
            onPress={() => signUp({ username, password })}
          />
        </View>
        {model.busy === undefined ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {model.busy}
          </Text>
        )}
        {model.signedIn === undefined ? null : (
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {model.signedIn}
          </Text>
        )}
        {model.error === undefined ? null : (
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={styles.error}
          >
            <Text style={styles.errorText}>{model.error}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Goes to the screen before. A route that opened first goes home.
function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.sky,
  },
  // The form fills the screen of a phone and stays in the content column on a wide window.
  content: {
    ...column,
    flexGrow: 1,
    paddingHorizontal: space.lg,
  },
  top: {
    alignItems: 'flex-start',
  },
  titleSign: {
    alignSelf: 'center',
    marginTop: space.md,
  },
  title: {
    color: palette.ink,
    fontFamily: serif,
    fontSize: 26,
    textAlign: 'center',
  },
  formSign: {
    alignSelf: 'stretch',
    marginTop: space.xl,
  },
  form: {
    alignSelf: 'stretch',
    gap: space.sm,
  },
  label: {
    color: palette.woodDark,
    fontFamily: serif,
    fontSize: 17,
  },
  field: {
    backgroundColor: palette.white,
    borderColor: palette.trim,
    borderRadius: radius.sm,
    borderWidth: 2,
    color: palette.ink,
    fontSize: 17,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  actions: {
    alignItems: 'center',
    gap: space.lg,
    marginTop: space.xl,
  },
  status: {
    alignSelf: 'center',
    marginTop: space.xl,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: palette.panel,
    borderRadius: radius.md,
    color: palette.ink,
    fontFamily: serif,
    fontSize: 16,
  },
  error: {
    alignSelf: 'stretch',
    marginTop: space.xl,
    backgroundColor: palette.panel,
    borderColor: palette.ribbon,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  errorText: {
    color: palette.ribbonDeep,
    fontFamily: serif,
    fontSize: 16,
    textAlign: 'center',
  },
});
