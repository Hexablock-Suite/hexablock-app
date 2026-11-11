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

// Domain and application code get time from an injected clock and randomness
// from an injected, seeded source. Then games are reproducible and testable.
const noAmbientNondeterminism = defineRule({
  meta: {
    type: 'problem',
    messages: {
      mathRandom:
        'Domain and application code must not use Math.random. Inject a seeded random source.',
      dateNow: 'Domain and application code must not use Date.now. Inject a clock.',
      newDate:
        'Domain and application code must not call new Date() without arguments. Inject a clock.',
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

// Tells if a key names `deliverTo`, as the identifier `deliverTo` or the text `'deliverTo'`.
function isDeliveryKey(key, computed) {
  if (!computed && key.type === 'Identifier') return key.name === 'deliverTo';
  return key.type === 'Literal' && key.value === 'deliverTo';
}

// Tells if a member expression names `deliverTo`, as `score.deliverTo` or `score['deliverTo']`.
function namesDelivery(node) {
  return isDeliveryKey(node.property, node.computed);
}

// Tells if a property of an object pattern takes `deliverTo`, as `{ deliverTo }` or `{ deliverTo: d }`.
function takesDelivery(property) {
  return property.type === 'Property' && isDeliveryKey(property.key, property.computed);
}

// A value object keeps its value private and delivers it to a receiver of the edge.
// Domain and application code compare with equals() or call a business operation.
// A reference without a call counts too, because bind() and call() make the call later.
// A destructuring counts too, because `const { deliverTo } = score` takes the same reference.
// The declaration of the operation in a value object is not a member expression or a pattern.
// The rule cannot see a key that the code builds at run time: `x[n]`, `Reflect.get` or a template literal.
const noDeliveryCall = defineRule({
  meta: {
    type: 'problem',
    messages: {
      deliveryCall:
        'Domain and application code must not call deliverTo. Compare with equals() or call a business operation. Only an adapter receives the value.',
    },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (namesDelivery(node)) {
          context.report({ node, messageId: 'deliveryCall' });
        }
      },
      ObjectPattern(node) {
        for (const property of node.properties) {
          if (takesDelivery(property)) {
            context.report({ node: property, messageId: 'deliveryCall' });
          }
        }
      },
    };
  },
});

export default definePlugin({
  meta: { name: 'hexablock' },
  rules: {
    'no-ambient-nondeterminism': noAmbientNondeterminism,
    'no-delivery-call': noDeliveryCall,
  },
});
