// Oxlint JS plugin with the HexaBlock domain rules.
import { definePlugin, defineRule } from 'vite-plus/lint/plugins';

function isMember(node, object, property) {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === object &&
    node.property.type === 'Identifier' &&
    node.property.name === property
  );
}

// Domain code gets time from an injected clock and randomness from an
// injected, seeded source. Then games are reproducible and testable.
const noAmbientNondeterminism = defineRule({
  meta: {
    type: 'problem',
    messages: {
      mathRandom: 'Domain code must not use Math.random. Inject a seeded random source.',
      dateNow: 'Domain code must not use Date.now. Inject a clock.',
      newDate: 'Domain code must not call new Date() without arguments. Inject a clock.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isMember(node, 'Math', 'random')) {
          context.report({ node, messageId: 'mathRandom' });
        }
        if (isMember(node, 'Date', 'now')) {
          context.report({ node, messageId: 'dateNow' });
        }
      },
      NewExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'Date' &&
          node.arguments.length === 0
        ) {
          context.report({ node, messageId: 'newDate' });
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: 'hexablock' },
  rules: { 'no-ambient-nondeterminism': noAmbientNondeterminism },
});
