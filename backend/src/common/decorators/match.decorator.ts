import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Valida se o campo é igual a outro campo do mesmo objeto.
 * Usado principalmente na confirmação de senha do cadastro.
 */
export function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'match',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedProperty] = args.constraints as [string];
          const relatedValue = (args.object as Record<string, unknown>)[relatedProperty];
          return value === relatedValue;
        },
      },
    });
  };
}
