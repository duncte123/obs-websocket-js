type SimpleObject = { [key: string]: any };

export default function (obj: SimpleObject = {}): SimpleObject {
  for (const key in obj) {
    if (!{}.hasOwnProperty.call(obj, key)) {
      continue;
    }

    // eslint-disable-next-line prefer-named-capture-group
    const camelCasedKey: string = key.replace(/-([a-z])/gi, ($0, $1) => $1.toUpperCase());

    obj[camelCasedKey] = obj[key];
  }

  return obj;
}
