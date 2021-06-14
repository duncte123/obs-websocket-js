export default function (obj: { [key: string]: any } = {}) {
  for (const key in obj) {
    if (!{}.hasOwnProperty.call(obj, key)) {
      continue;
    }

    const camelCasedKey: string = key.replace(/-([a-z])/gi, ($0, $1) => {
      return $1.toUpperCase();
    });

    obj[camelCasedKey] = obj[key];
  }

  return obj;
}
