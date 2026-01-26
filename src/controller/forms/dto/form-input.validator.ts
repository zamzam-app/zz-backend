import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { FieldType } from '../entities/form.entity';

export function IsValidFormInput(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidFormInput',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const obj = args.object as any;
          const fieldType = obj.field_type;

          if (value === undefined || value === null) {
            return true; // Optional field
          }

          switch (fieldType) {
            case FieldType.ShortAnswer:
            case FieldType.Paragraph:
            case FieldType.MultipleChoice:
              return typeof value === 'string';

            case FieldType.Checkboxes:
              return (
                Array.isArray(value) &&
                value.every((item) => typeof item === 'string')
              );

            case FieldType.StarRating:
              return typeof value === 'number' && value >= 1 && value <= 5;

            default:
              return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as any;
          const fieldType = obj.field_type;

          switch (fieldType) {
            case FieldType.ShortAnswer:
            case FieldType.Paragraph:
              return 'Input must be a string for text/textarea fields';
            case FieldType.MultipleChoice:
              return 'Input must be a string for multiple choice selection';
            case FieldType.Checkboxes:
              return 'Input must be an array of strings for checkbox selections';
            case FieldType.StarRating:
              return 'Input must be a number between 1 and 5 for star rating';
            default:
              return 'Invalid field type';
          }
        },
      },
    });
  };
}
