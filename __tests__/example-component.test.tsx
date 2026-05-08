import { render, screen } from "@testing-library/react";

function WelcomeMessage({ name }: { name: string }) {
  return <h1>Bem-vindo, {name}!</h1>;
}

describe("WelcomeMessage", () => {
  it("renderiza o texto com o nome informado", () => {
    render(<WelcomeMessage name="SGDE" />);

    expect(
      screen.getByRole("heading", { name: "Bem-vindo, SGDE!" }),
    ).toBeInTheDocument();
  });
});
