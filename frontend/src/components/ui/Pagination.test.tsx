import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('does not render when there is only one page', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} total={3} onPageChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the summary and disables "Previous" on the first page', () => {
    render(<Pagination page={1} totalPages={3} total={20} onPageChange={vi.fn()} />);

    expect(screen.getByText(/Página/)).toHaveTextContent('Página 1 de 3');
    expect(screen.getByText(/Página/)).toHaveTextContent('20 receitas');
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeEnabled();
  });

  it('triggers navigation to the next page', async () => {
    const onPageChange = vi.fn();

    render(<Pagination page={2} totalPages={3} total={20} onPageChange={onPageChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }));
    await userEvent.click(screen.getByRole('button', { name: 'Página anterior' }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
  });

  it('disables "Next" on the last page and uses the singular form', () => {
    render(<Pagination page={2} totalPages={2} total={1} onPageChange={vi.fn()} />);

    expect(screen.getByText(/Página/)).toHaveTextContent('1 receita');
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
  });
});
