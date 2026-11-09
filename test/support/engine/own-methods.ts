// A spread copies only own members, and a class keeps its methods on its prototype.
// Some tests spread a topology to replace one method.
// So this function gives a copy with each method as an own member, bound to the original.
export function withOwnMethods<TTopology extends object>(topology: TTopology): TTopology {
  const copy: object = { ...topology };
  const prototype: object = Object.getPrototypeOf(topology);
  for (const name of Object.getOwnPropertyNames(prototype)) {
    const member: unknown = Reflect.get(topology, name);
    if (name !== 'constructor' && typeof member === 'function') {
      Reflect.set(copy, name, member.bind(topology));
    }
  }
  return copy as TTopology;
}
